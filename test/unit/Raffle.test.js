const { assert, expect } = require("chai");
const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip 
  : describe("Raffle", function () {

      let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval, subscriptionId;
      const chainId = network.config.chainId;

      /**
       * @dev 做一些测试前的初始化工作
       * 1. 部署并获取所有合约
       * 2. 获取 deployer，raffleEntranceFee，interval，subscriptionId
       * 3. 将 raffle 合约添加为 vrfCoordinatorV2Mock 的 consumer
       */
      beforeEach(async function() {
        // 在测试开始之前先要部署所有合约
        await deployments.fixture(["all"]);
        // 获取部署的两个合约
        raffle = await ethers.getContract("Raffle", deployer);
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
        deployer = (await getNamedAccounts()).deployer;
        raffleEntranceFee = await raffle.getEntranceFee();
        console.log(raffleEntranceFee.toString());
        interval = await raffle.getInterval();
        subscriptionId = await raffle.getSubscriptionId();
        // 将 raffle 合约添加为 vrfCoordinatorV2Mock 的 consumer
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address);
      });

      /**
       * @dev 测试构造函数的初始化是否正常
       * 1. raffleState 应初始化为 OPEN 状态
       * 2. interval 应初始化为 30 秒
       */
      describe("constructor", function () {

        it("initializes the raffle correctly", async function () {
          // Ideally we make our tests have just 1 assert per `it`
          const raffleState = await raffle.getRaffleState();
          assert.equal(raffleState.toString(), "0");
          assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
        });
      });

      /**
       * @dev 测试 enterRaffle() 方法
       * 1. 当发送的 ETH 不够时方法应该抛出 Raffle__NotEnoughETHEntered 错误
       * 2. 当玩家发送了足够的 ETH 进入了游戏后，玩家地址应被添加到 s_players 数组中
       * 3. 玩家进入游戏成功后应发出 RaffleEnter 事件
       * 4. 当 raffleState 为 CALCULATING 时，不允许玩家进入
       */
      describe("enterRaffle", function () {
        
        it("reverts when you don't pay enough", async function () {
          await expect(raffle.enterRaffle())
            .to.be.revertedWith("Raffle__NotEnoughETHEntered");
        });  

        it("records players when they enter", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          const playerFromContract = await raffle.getPlayer(0);
          assert.equal(playerFromContract, deployer);
        });

        it("emits event on enter", async function () {
          await expect(raffle.enterRaffle({ value: raffleEntranceFee }))
            .to.emit(raffle, "RaffleEnter");
        });

        it("doesn't allow entrance when raffle is calculating", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          // hardhat 提供的一些对本地 blockchain 的操作: https://trufflesuite.com/blog/introducing-ganache-7/#6-fast-forward-time
          // 这里的 `evm_increaseTime` 操作可以将 blockchain 的时间戳增加
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          // 挖一个空 block，这样新的 block 的 timestamp 就更新了，这样做是因为在 raffle.sol - checkUpkeep()
          // 方法中使用 block.timestamp - s_lastTimestamp > i_interval 来判断是否过了足够的时间，block.timestamp 
          // 会获取最新 block 的时间戳，在我们把 blockchain 的时间戳向后推移之后，最新 block 的时间戳还是推移之前的时间戳，
          // 如果这个时候使用 block.timestamp，获取到的还是未更新的时间戳，所以要新挖一个空 block，上面会保存最新的时间戳，
          // 这样使用 block.timestamp 获得的就是更新后的时间戳了
          // https://trufflesuite.com/blog/introducing-ganache-7/#5-mine-blocks-instantly-at-interval-or-on-demand
          await network.provider.send("evm_mine", []);
          // 假装自己是 chainlink automation，满足所有 checkUpkeep 中的条件，
          // 调用 performUpkeep()，raffleState 变成 CALCULATING 状态
          await raffle.performUpkeep([]);
          await expect(raffle.enterRaffle({ value: raffleEntranceFee }))
            .to.be.revertedWith("Raffle__NotOpen");
        });
      });

      /**
       * @dev 测试 checkUpkeep() 方法
       * 1. 如果没有人发送 ETH 应返回 false
       * 2. 如果 raffleState 不是 OPEN 状态，应返回 false
       * 3. 如果没有过去足够的时间（currentTimestamp - lastTimestamp <= interval），应返回 false
       * 4. 如果 raffleState 为 OPEN 状态，有玩家发送了足够的 ETH 并且过去了足够的时间，应返回 true
       */
      describe("checkUpkeep", function () {

        it("returns false if people haven't sent any ETH", async function () {
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.send("evm_mine", []);
          // 如果直接调用 raffle.checkUpkeep() 会产生 transaction，这里只是想模拟 checkUpkeep()
          // 的执行过程，获得它的执行结果，而并不想产生 transaction，所以这里可以使用 callStatic
          // https://docs.ethers.io/v5/api/contract/contract/#contract-callStatic
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert(!upkeepNeeded);
        });

        it("returns false if raffle isn't open", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await raffle.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await raffle.provider.send("evm_mine", []);
          await raffle.performUpkeep([]);
          const raffleState = await raffle.getRaffleState();
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert.equal(raffleState.toString(), "1");
          assert.equal(upkeepNeeded, false);
        });

        it("returns false if enough time hasn't passed", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() - 10]);
          await network.provider.request({ method: "evm_mine", params: [] });
          // 这里的 "0x" 在 solidity 中会自动转换为 bytes
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
          assert(!upkeepNeeded);
        });

        it("returns true if enough time has passed, has players, eth, and is open", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
          assert(upkeepNeeded);
        });
      });

      describe("performUpkeep", function () {

        it("it can only run if checkUpkeep is true", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const tx = await raffle.performUpkeep([]);
          assert(tx);
        });

        it("reverts when checkUpkeep is false", async function () {
          await expect(raffle.performUpkeep([]))
            .to.be.revertedWith("Raffle__NotNeeded");
        });

        it("updates the raffle state, emits an event, and calls the vrf coordinator", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const txResponse = await raffle.performUpkeep([]);
          const txReceipt = await txResponse.wait(1);
          const requestId = txReceipt.events[1].args.requestId;
          const raffleState = await raffle.getRaffleState();
          assert(requestId.toNumber() > 0);
          assert(raffleState.toString() == "1");
        });
      });

      describe("fulfillRandomWords", function () {

        beforeEach(async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.send("evm_mine", []);
        });

        it("can only be called after performUpkeep", async function () {
          // vrfCoordinatorV2Mock.fulfillRandomWords() 方法需要 requestId 参数，而这个参数只能
          // 在调用了 raffle.performUpkeep() 方法之后才会产生
          await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address))
            .to.be.revertedWith("nonexistent request");
          await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address))
            .to.be.revertedWith("nonexistent request");
        });

        it("picks a winner, resets the lottery, and sends money", async function () {

          const additionalEntrants = 3;
          const startingAccountIndex = 1; // deployer = 0
          const accounts = await ethers.getSigners();
          for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
            const accountConnectedRaffle = raffle.connect(accounts[i]);
            await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee });
          }
          const startingTimestamp = await raffle.getLatestTimestamp();

          // performUpkeep (mock being chainlink keepers)
          // fulfillRandomWords (mock being the Chainlink VRF)
          // tutorial about async-await: https://javascript.info/async-await
          await new Promise(async (resolve, reject) => {      
            // 在 Promise 中设置一个监听 WinnerPicked 事件的 Listener，当 Listener 发现该事件触发时，
            // 才开始验证各项参数是否被正确初始化，这里需要验证的参数有:
            // 1. s_players 数组为空
            // 2. raffleState 为 OPEN 状态
            // 3. lastTimestamp 时间戳应被更新
            // 4. winner 账户的余额是否增加
            raffle.once("WinnerPicked", async () => {
              console.log("Found the event!");
              try {
                const recentWinner = await raffle.getRecentWinner();
                console.log(`The recent winner is ${recentWinner}`);
                console.log("All players are listed below:");
                for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
                  console.log(accounts[i].address);
                }

                const raffleState = await raffle.getRaffleState();
                const endingTimestamp = await raffle.getLatestTimestamp();
                const numPlayers = await raffle.getNumberOfPlayers();
                // 根据 vrfCoordinatorV2Mock.fulfillRandomWords() 方法中计算随机数的算法，这里赢家应该
                // 固定是 accounts[1]，所以这里直接使用 accounts[1] 作为赢家
                const winnerEndingBalance = await accounts[1].getBalance();
                // s_players 数组被清空
                assert.equal(numPlayers.toString(), "0");
                // raffleState 为 OPEN 状态
                assert.equal(raffleState.toString(), "0");
                assert(endingTimestamp > startingTimestamp);
                // winnerEndingBalance = winnerStartingBalance + (additionalEntrants * raffleEntranceFee + raffleEntranceFee)
                assert.equal(winnerEndingBalance.toString(), 
                  winnerStartingBalance
                    .add(
                      raffleEntranceFee
                        .mul(additionalEntrants)
                        .add(raffleEntranceFee)
                    ).toString()
                );
              } catch (e) {
                reject(e);
              }
              resolve();
            });

            // 在这里我们模拟 chainlink automation 去调用 raffle.performUpkeep() 方法，从 txReceipt 
            // 中获取 requestId，再模拟 vrfCoordinatorV2Mock.fulfillRandomWords() 方法，方法执行成后会 
            // emit WinnerPicked 事件，从而会被我们在 Promise 中设置的 Listener 监听到
            const tx = await raffle.performUpkeep([]);
            const txReceipt = await tx.wait(1);
            const requestId = txReceipt.events[1].args.requestId;
            // 根据 vrfCoordinatorV2Mock.fulfillRandomWords() 方法中计算随机数的算法，这里赢家应该
            // 固定是 accounts[1]，所以这里直接使用 accounts[1] 作为赢家
            const winnerStartingBalance = await accounts[1].getBalance();
            await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.address);
          });
        });

      });

    });
