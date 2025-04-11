// migrations/2_deploy_inventory.js
const InventorySystem = artifacts.require("InventorySystem");

module.exports = function(deployer) {
  deployer.deploy(InventorySystem);
};