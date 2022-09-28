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
  let Lottery, deployer, lotteryEntranceFee
  const chainId = network.config.chainId
  developmentChains.includes(network.name)
    ? describe.skip
    : beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer
        Lottery = await ethers.getContract("Lottery", deployer)
        lotteryEntranceFee = await Lottery.getEntranceFee()
      })
  describe("fulfillRandomWords", function () {
    it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
      console.log("Setting up test...")
      const startingTimeStamp = await Lottery.getLatestTimeStamp()
      const accounts = await ethers.getSigners()

      console.log("Setting up Listener...")
      await new Promise(async (resolve, reject) => {
        Lottery.once("WinnerPicked", async () => {
          console.log("WinnerPicked event fired!")
          try {
            const recentWinner = await Lottery.getRecentWinner()
            const lotteryState = await Lottery.getLotteryState()
            const winnerEndingBalance = await accounts[0].getBalance()
            const endingTimeStamp = await Lottery.getLatestTimeStamp()

            await expect(Lottery.getPlayer(0)).to.be.reverted
            assert.equal(recentWinner.toString(), accounts[0].address)
            assert.equal(lotteryState, 0)
            assert.equal(
              winnerEndingBalance.toString(),
              winnerStartingBalance.add(lotteryEntranceFee).toString()
            )
            assert(endingTimeStamp > startingTimeStamp)
            resolve()
          } catch (error) {
            console.log(error)
            reject(error)
          }
        })

        console.log("Entering Lottery...")
        const tx = await Lottery.enterLottery({ value: lotteryEntranceFee })
        await tx.wait(1)
        console.log("Ok, time to wait...")
        const winnerStartingBalance = await accounts[0].getBalance()
      })
    })
  })
})
