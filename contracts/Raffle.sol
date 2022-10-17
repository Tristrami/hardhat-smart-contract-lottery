// Raffle
// Enter the lottery (paying some amount)
// Pick a random winner (verifiably random)
// Winner ro be selected every X minites => completly automate
// Chainlink Oracle => Randomness, Automated Execution (Chainlink Keepers)

// Some tutorial related to this section
// Evnets and Log: https://media.consensys.net/technical-introduction-to-events-and-logs-in-ethereum-a074d65dd61e
// Chainlink VRF: https://docs.chain.link/docs/vrf/v2/introduction/
// Chainlink Automation: https://docs.chain.link/docs/chainlink-automation/introduction/

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import '@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol';
import '@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol';
import '@chainlink/contracts/src/v0.8/ConfirmedOwner.sol'; 
import '@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol'; // yarn add --dev @chainlink/contracts

error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__NotNeeded(uint256 cuurentBalance, uint256 numPlayers, uint256 raffleState);

/**
 * @title A sample Raffle Contract
 * @author seamew
 * @notice This contract is for creating an untamperable decentralized smart contract
 * @dev This implements Chainlink VRF v2 and Chainlink Keepers
 */
contract Raffle is VRFConsumerBaseV2, ConfirmedOwner, AutomationCompatibleInterface
{
    /* Type declarations */
    enum RaffleState
    {   
        OPEN,
        CALCULATING
    }

    /* State Variables */
    address payable[] private s_players; 
    uint256 private s_lastTimestamp;

    // Immutable variables
    uint256 private immutable i_entraceFee;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;

    // Constant Variables
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    // Lottery Variables
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private immutable i_interval;

    /* Events */
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 requestId);
    event WinnerPicked(address indexed winner);
    event UpkeepCheck(bool indexed upkeepNeeded);

    constructor(
        address vrfCoordinatorV2, // contract
        uint256 entranceFee, 
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) 
        VRFConsumerBaseV2(vrfCoordinatorV2)
        ConfirmedOwner(msg.sender) 
    {
        i_entraceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimestamp = block.timestamp;
        i_interval = interval;
    }

    function enterRaffle() public payable
    {
        if (msg.value < i_entraceFee) {
            revert Raffle__NotEnoughETHEntered(); 
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender)); 
        // Emit an event when we update a dynamic array or mapping
        // Named events with the function name reversed
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev This is the function that the Chainlink Keeper nodes call they look
     * for the `upKeepNeeded` to return true. The following should be true in
     * order to return true
     * 1. The lottery should be in an `OPEN` state
     * 2. Our time interval should have passed
     * 3. The lottery should have at least 1 palyer, and have some ETH
     * 4. Our subscription is funded with link
     */
    function checkUpkeep(bytes memory /* checkData */) public override returns (bool upkeepNeeded, bytes memory /* performData */) 
    {
        bool isOpen = (RaffleState.OPEN == s_raffleState);
        bool timePassed = (block.timestamp - s_lastTimestamp > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
        emit UpkeepCheck(upkeepNeeded);
    }

    /**
     * @dev This function requires a random word
     */
    function performUpkeep(bytes calldata /* performData */) external override
    {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle__NotNeeded(address(this).balance, s_players.length, uint256(s_raffleState));
        }

        // https://docs.chain.link/docs/vrf/v2/subscription/examples/get-a-random-number/
        // Request the random number
        // Once we get it, do something with it
        // 2 transaction process  
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestedRaffleWinner(requestId);
    }

    function fulfillRandomWords(uint256 /* requestId */, uint256[] memory randomWords) internal override
    {
        // Get the winner according to the random number
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        // Change the raffleState
        s_raffleState = RaffleState.OPEN;
        // Reset s_players array
        s_players = new address payable[](0);       
        // Reset s_lastTimestamp
        s_lastTimestamp = block.timestamp;
        // Send balance to the winner
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    /* View / Pure functions */

    function getEntranceFee() public view returns (uint256)
    {
        return i_entraceFee;
    }

    function getPlayer(uint256 index) public view returns (address)
    {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address)
    {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState)
    {
        return s_raffleState;
    }

    function getNumWords() public pure returns (uint256)
    {
        // NUM_WORDS 是常量，被编译在字节码中，这里会被直接替换为 `1`，不需要从 
        // storage 中获取，所以这个函数可以是 pure
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns (uint256)
    {
        return s_players.length;
    }

    function getLatestTimestamp() public view returns (uint256)
    {
        return s_lastTimestamp;
    }

    function getRequestConfirmations() public pure returns (uint256)
    {
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() public view returns (uint256)
    {
        return i_interval;
    }

    function getSubscriptionId() public view returns (uint256)
    {
        return i_subscriptionId;
    }
}