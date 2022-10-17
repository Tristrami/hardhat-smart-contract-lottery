const { run } = require("hardhat");

const verify = async function (contractAddress, args) {
  console.log("Verifying ...");
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
    console.log("Done!");
  } catch (e) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("Already verified!");
    } else {
      console.log(e);
    }
  }
}

module.exports = {
  verify,
};