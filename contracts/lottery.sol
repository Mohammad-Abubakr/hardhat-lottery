//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

error Lottery__notEnoughETH();
error Lottery__transferFailed();
error Lottery__notOpen();
error Lottery__UpkeepNotNeeded(
    uint256 balance,
    uint256 numPlayers,
    uint256 state
);

contract Lottery is VRFConsumerBaseV2, KeeperCompatibleInterface {
    enum LotteryState {
        OPEN,
        CALCULATING
    }

    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subId;
    uint32 private immutable i_callBackGasLimit;
    uint256 private immutable i_interval;

    uint16 private constant MINIMUM_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    address private s_recentWinner;
    LotteryState s_state;
    uint256 private s_lastTimeStamp;

    event lotterEnter(address indexed player);
    event RequestedRaffleID(uint256 indexed requestID);
    event WinnerPicked(address indexed winner);

    constructor(
        address vrfCoordinatorV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subId,
        uint32 callBackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subId = subId;
        i_callBackGasLimit = callBackGasLimit;
        s_state = LotteryState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterLottery() public payable {
        if (msg.value < i_entranceFee) {
            revert Lottery__notEnoughETH();
        }

        if (s_state != LotteryState.OPEN) {
            revert Lottery__notOpen();
        }
        s_players.push(payable(msg.sender));
    }

    function performUpkeep(
        bytes memory /*performData*/
    ) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Lottery__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_state)
            );
        }
        s_state = LotteryState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subId,
            MINIMUM_CONFIRMATIONS,
            i_callBackGasLimit,
            NUM_WORDS
        );
        emit RequestedRaffleID(requestId);
    }

    function checkUpkeep(
        bytes memory /*checkData*/
    )
        public
        view
        override
        returns (
            bool upkeepNeeded,
            bytes memory /*performData*/
        )
    {
        bool isOpen = (s_state == LotteryState.OPEN);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (isOpen && hasPlayers && hasBalance && timePassed);
    }

    function fulfillRandomWords(
        uint256, /*requestId*/
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_state = LotteryState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");

        if (!success) {
            revert Lottery__transferFailed();
        }

        emit WinnerPicked(recentWinner);
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayers(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecenetWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getLotteryState() public view returns (LotteryState) {
        return s_state;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function numberPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLatestTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return MINIMUM_CONFIRMATIONS;
    }
}
