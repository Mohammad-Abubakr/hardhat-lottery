const { deployments, getNamedAccounts, ethers, network } = require("hardhat")
const { assert, expect } = require("chai")
const {
  networkConfig,
  developmentChains,
} = require("../../helper-hardhat-config")
const { int } = require("hardhat/internal/core/params/argumentTypes")
const { providers } = require("ethers")
const { etherscan } = require("../../hardhat.config")

describe("Lottery", () => {
  let VRFCoordinatorV2Mock, Lottery, deployer, lotteryEntranceFee, interval
  const chainId = network.config.chainId
  !developmentChains.includes(network.name)
    ? describe.skip
    : beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        VRFCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        )
        Lottery = await ethers.getContract("Lottery", deployer)
        lotteryEntranceFee = await Lottery.getEntranceFee()
        interval = await Lottery.getInterval()
      })
  describe("Constructor", () => {
    it("initializes all the values correctly", () => {
      const state = Lottery.getLotteryState()
      assert(state.toString(), "0")
      assert(interval, networkConfig[chainId]["interval"])
    })
  })

  describe("EnterLotter", () => {
    it("reverts when enough money is not paid", async () => {
      await expect(Lottery.enterLottery()).to.be.reverted
    })

    it("records player when they enter", async () => {
      await Lottery.enterLottery({ value: lotteryEntranceFee })
      const playerFromContract = await Lottery.getPlayers(0)
      assert(playerFromContract, deployer)
    })

    it("emits an event when player enters the Lottery", async () => {
      await expect(Lottery.enterLottery({ value: lotteryEntranceFee })).to.emit(
        Lottery,
        "LotteryEnter"
      )
    })

    it("doesnt allow to enter in Calculating state", async () => {
      await Lottery.enterLottery({ value: lotteryEntranceFee })
      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
      await network.provider.send("evm_mine", [])
      await Lottery.performUpkeep([])
      await expect(Lottery.enterLottery({ value: lotteryEntranceFee })).to.be
        .reverted
    })
  })

  describe("upKeepNeeded", () => {
    it("Returns false if not enogh ETH sent", async () => {
      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
      await network.provider.send("evm_mine", [])
      const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep([])
      assert(!upkeepNeeded)
    })

    it("returns false if lottery isnt open", async () => {
      await Lottery.enterLottery({ value: lotteryEntranceFee })
      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
      await network.provider.send("evm_mine", [])
      await Lottery.performUpkeep([])
      const state = await Lottery.getLotteryState()
      const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep([])
      assert.equal(state.toString(), "1")
      assert.equal(upkeepNeeded, false)
    })
  })

  describe("performUpkeep", () => {
    it("Runs only when upKeepneeded is true", async () => {
      await Lottery.enterLottery({ value: lotteryEntranceFee })
      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
      await network.provider.send("evm_mine", [])
      const tx = await Lottery.performUpkeep([])
      console.log(`${tx}`)
      assert(tx)
    })

    it("reverts when checkupKeepis false", async () => {
      await expect(Lottery.performUpkeep([])).to.be.reverted
    })

    it("emits the number, updates raffle state and calls vrfCoordinator", async () => {
      await Lottery.enterLottery({ value: lotteryEntranceFee })
      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
      await network.provider.send("evm_mine", [])
      const txResponse = await Lottery.performUpkeep([])
      const txReceipt = await txResponse.wait(1)
      const requestId = txReceipt.events[1].args.requestId
      const state = await Lottery.getLotteryState()
      assert(requestId.toNumber() > 0)
      assert(state.toString() == "1")
    })
  })

  describe("fulfillRandomWords", () => {
    beforeEach(async () => {
      await Lottery.enterLottery({ value: lotteryEntranceFee })
      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
      await network.provider.request({ method: "evm_mine", params: [] })
    })
    it("can only be called after perform upkeep", async () => {
      await expect(
        VRFCoordinatorV2Mock.fulfillRandomWords(0, Lottery.address) // reverts if not fulfilled
      ).to.be.revertedWith("nonexistent request")
      await expect(
        VRFCoordinatorV2Mock.fulfillRandomWords(1, Lottery.address) // reverts if not fulfilled
      ).to.be.revertedWith("nonexistent request")
    })
  })

  it("picks the winner, resets the lottery and sends money", async () => {
    const additionalParticipants = 3
    const startingIndex = 1
    const accounts = await etherscan.getSigners()
    for (
      let i = startingIndex;
      i < startingIndex + additionalParticipants;
      i++
    ) {
      const accountConnectedLottery = Lottery.connect(accounts[i])
      await accountConnectedLottery.enterLottery({ value: lotteryEntranceFee })
    }
  })
})
