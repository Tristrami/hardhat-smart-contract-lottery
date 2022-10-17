const { expect, assert } = require("chai");
const { network, getNamedAccounts, ethers } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle staging test", function () {

    let deployer, raffle, raffleEntranceFee;
    const chainId = network.config.chainId;

    beforeEach(async function () {
      // deployer 这里是 string 类型的钱包地址
      deployer = (await getNamedAccounts()).deployer;
      raffle = await ethers.getContract("Raffle", deployer);
      raffleEntranceFee = await raffle.getEntranceFee();
    });

    describe("fulfillRandomWords", function () {

      it("works with live Chainlink Automation and Chainlink VRF, we get a random winner", async function () {
        
        const startingTimestamp = await raffle.getLatestTimestamp();
        // ethers.getSigners() 返回 SignerWithAddress 类型的数组，SignerWithAddress 中封装了 getBalance() 方法，
        // 而我们在上面获取的 deployer 仅仅是一个字符串，无法获取它的 balance
        const accounts = await ethers.getSigners();
        await new Promise(async (resolve, reject) => {
          // 在进入游戏前设置一个 WinnerPicked 事件的监听器
          raffle.once("WinnerPicked", async () => {
            console.log("WinnerPicked event fired!");
            try {
              const recentWinner = await raffle.getRecentWinner();
              const raffleState = await raffle.getRaffleState();
              // 只用 deployer 进入了游戏，所以 winner 就是 deployer
              const winnerEndingBalance = await accounts[0].getBalance();
              const endingTimestamp = await raffle.getLatestTimestamp();

              // s_players 数组应被初始化
              await expect(raffle.getPlayer(0)).to.be.reverted;
              // 当前的赢家应是 deployer
              assert.equal(recentWinner.toString(), await accounts[0].getAddress());
              assert.equal(raffleState, 0);
              assert.equal(
                winnerEndingBalance.toString(), 
                winnerStartingBalance.add(raffleEntranceFee).toString()
              );
              assert(endingTimestamp > startingTimestamp);
              resolve();
            } catch (e) {
              console.log(e);
              reject(e);
            }
          });
          // 调用 enterRaffle 进入游戏
          await raffle.enterRaffle({ value: raffleEntranceFee });
          const winnerStartingBalance = await accounts[0].getBalance();
        });
      });
    })
  });