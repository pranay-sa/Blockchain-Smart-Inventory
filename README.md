# Blockchain-Smart-Inventory
Blockchain DApp built on ethereum to track product lifecycle, Read this file to get it running on your system

**Prerequisites: Ganache, MetaMask **

1) After Installing Files, run the below command on your root directory
   npm install -g truffle

2) Install http server to run our frontend
   npm install -g http-server

3) Compile the truffle files, by running the below command on root
   truffle compile

   then run
   truffle migrate

4) Copy ContractABI from build json file to app.js , and add contract address in app.js obtained from hash address after running truffle migrate

5) Connect your metamask account to local ganache using private key obtained from Ganache GUI
6) Connect to localhost in MetaMask by adding a network with RPC obtained from Ganache (mostly HTTP://127.0.0.1:7545) , chain id and name gets configured atomatically and add ETH as currency.

7) Thats it! now run the frontend by "http-server client" (from root) and open the frontend and conect ypur metamask account, you can now add and transfer products to other accounts (login through other metamask wallet to approve the transactions) !
