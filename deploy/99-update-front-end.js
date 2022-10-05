const { etherscan } = require("../hardhat.config")
const fs = require("fs")
const { network } = require("hardhat")
require("dotenv").config()

const FRONT_END_ADDRESS_FILE =
  "../nextjs-sc-lottery/constants/contractAddresses.json"
const FRONT_END_ABI_FILE = "../nextjs-sc-lottery/constants/abi.json"
module.exports = async () => {
  if (process.env.UPDATE_FRONT_END) {
    updateAddresses()
    updateAbi()
  }
}

async function updateAbi() {
  const lottery = await ethers.getContract("Lottery")
  fs.writeFileSync(
    "../nextjs-sc-lottery/constants/abi.json",
    lottery.interface.format(ethers.utils.FormatTypes.json)
  )
}

async function updateAddresses() {
  const lottery = await ethers.getContract("Lottery")
  const chainId = network.config.chainId.toString()
  const currentAddresses = JSON.parse(
    fs.readFileSync(FRONT_END_ADDRESS_FILE, "utf8")
  )

  if (chainId in currentAddresses) {
    if (!currentAddresses[chainId]) {
      currentAddresses[chainId].push(lottery.address)
    }
  }
  {
    currentAddresses[chainId] = [lottery.address]
  }

  fs.writeFileSync(FRONT_END_ADDRESS_FILE, JSON.stringify(currentAddresses))
}

module.exports.tags = ["all", "front-end"]
