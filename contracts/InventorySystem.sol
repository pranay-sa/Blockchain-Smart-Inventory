// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract InventorySystem {
    struct Product {
        string name;
        string category;
        uint256 quantity;
        string unit;
        uint256 productionTimestamp;
        uint256 shelfLifeDays;
        uint256 expiryTimestamp;
        string storageRequirements;
        address currentOwner;
        bool inTransit;
        address pendingRecipient;
    }
    
    // Mapping from UID to Product
    mapping(string => Product) public products;
    
    // List of UIDs for each owner
    mapping(address => string[]) public ownerProducts;
    
    mapping(address => mapping(string => uint256)) private ownerProductIndexes;
    
    // Events
    event ProductRegistered(string indexed uid, string name, address indexed owner);
    event TransferInitiated(string indexed uid, address indexed from, address indexed to);
    event TransferCompleted(string indexed uid, address indexed from, address indexed to);
    event ProductUpdated(string indexed uid, uint256 newQuantity);
    event ProductRemoved(string indexed uid, address indexed owner);
    
    constructor() {}

    // Register a new product
    function registerProduct(
        string memory _uid,
        string memory _name,
        string memory _category,
        uint256 _quantity,
        string memory _unit,
        uint256 _productionTimestamp,
        uint256 _shelfLifeDays,
        string memory _storageRequirements
    ) public returns (bool) {
        require(bytes(_uid).length > 0, "UID cannot be empty");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_quantity > 0, "Quantity must be greater than 0");
        require(_shelfLifeDays > 0, "Shelf life must be greater than 0");
        require(products[_uid].currentOwner == address(0), "Product with this UID already exists");
        
        uint256 _expiryTimestamp = _productionTimestamp + (_shelfLifeDays * 1 days);
        
        Product memory newProduct = Product({
            name: _name,
            category: _category,
            quantity: _quantity,
            unit: _unit,
            productionTimestamp: _productionTimestamp,
            shelfLifeDays: _shelfLifeDays,
            expiryTimestamp: _expiryTimestamp,
            storageRequirements: _storageRequirements,
            currentOwner: msg.sender,
            inTransit: false,
            pendingRecipient: address(0)
        });
        
        products[_uid] = newProduct;
        ownerProducts[msg.sender].push(_uid);
        ownerProductIndexes[msg.sender][_uid] = ownerProducts[msg.sender].length - 1;
        
        emit ProductRegistered(_uid, _name, msg.sender);
        return true;
    }

    // Batch register products
    function batchRegisterProducts(
        string[] memory _uids,
        string[] memory _names,
        string[] memory _categories,
        uint256[] memory _quantities,
        string[] memory _units,
        uint256[] memory _productionTimestamps,
        uint256[] memory _shelfLifeDays,
        string[] memory _storageRequirements
    ) public returns (bool) {
        require(_uids.length == _names.length, "Array lengths must match");
        require(_uids.length == _categories.length, "Array lengths must match");
        require(_uids.length == _quantities.length, "Array lengths must match");
        require(_uids.length == _units.length, "Array lengths must match");
        require(_uids.length == _productionTimestamps.length, "Array lengths must match");
        require(_uids.length == _shelfLifeDays.length, "Array lengths must match");
        require(_uids.length == _storageRequirements.length, "Array lengths must match");
        require(_uids.length <= 50, "Maximum 50 products per batch");

        for (uint i = 0; i < _uids.length; i++) {
            registerProduct(
                _uids[i],
                _names[i],
                _categories[i],
                _quantities[i],
                _units[i],
                _productionTimestamps[i],
                _shelfLifeDays[i],
                _storageRequirements[i]
            );
        }
        
        return true;
    }

    function updateProductQuantity(string memory _uid, uint256 _newQuantity) public returns (bool) {
        require(products[_uid].currentOwner == msg.sender, "You don't own this product");
        require(_newQuantity > 0, "Quantity must be greater than 0");
        require(!products[_uid].inTransit, "Cannot update product in transit");
        
        products[_uid].quantity = _newQuantity;
        emit ProductUpdated(_uid, _newQuantity);
        return true;
    }

    // Remove a product
    function removeProduct(string memory _uid) public returns (bool) {
        require(products[_uid].currentOwner == msg.sender, "You don't own this product");
        require(!products[_uid].inTransit, "Cannot remove product in transit");
        
        uint256 index = ownerProductIndexes[msg.sender][_uid];
        uint256 lastIndex = ownerProducts[msg.sender].length - 1;
        
        if (index != lastIndex) {
            string memory lastUid = ownerProducts[msg.sender][lastIndex];
            ownerProducts[msg.sender][index] = lastUid;
            ownerProductIndexes[msg.sender][lastUid] = index;
        }
        
        ownerProducts[msg.sender].pop();
        delete ownerProductIndexes[msg.sender][_uid];
        delete products[_uid];
        
        emit ProductRemoved(_uid, msg.sender);
        return true;
    }

    function getProduct(string memory _uid) public view returns (
        string memory name,
        string memory category,
        uint256 quantity,
        string memory unit,
        uint256 productionTimestamp,
        uint256 shelfLifeDays,
        uint256 expiryTimestamp,
        string memory storageRequirements,
        address currentOwner,
        bool inTransit,
        address pendingRecipient
    ) {
        Product memory product = products[_uid];
        require(product.currentOwner != address(0), "Product does not exist");
        
        return (
            product.name,
            product.category,
            product.quantity,
            product.unit,
            product.productionTimestamp,
            product.shelfLifeDays,
            product.expiryTimestamp,
            product.storageRequirements,
            product.currentOwner,
            product.inTransit,
            product.pendingRecipient
        );
    }

    // Initiate transfer to another owner
    function initiateTransfer(string memory _uid, address _to) public returns (bool) {
        require(products[_uid].currentOwner == msg.sender, "You don't own this product");
        require(!products[_uid].inTransit, "Product is already in transit");
        require(_to != address(0), "Invalid recipient address");
        require(_to != msg.sender, "Cannot transfer to yourself");
        
        products[_uid].inTransit = true;
        products[_uid].pendingRecipient = _to;
        
        emit TransferInitiated(_uid, msg.sender, _to);
        return true;
    }

    // Cancel a transfer
    function cancelTransfer(string memory _uid) public returns (bool) {
        require(products[_uid].currentOwner == msg.sender, "You don't own this product");
        require(products[_uid].inTransit, "Product is not in transit");
        
        products[_uid].inTransit = false;
        products[_uid].pendingRecipient = address(0);
        
        emit TransferInitiated(_uid, msg.sender, address(0)); // Using address(0) to indicate cancellation
        return true;
    }

    function confirmReceived(string memory _uid) public returns (bool) {
        require(products[_uid].inTransit, "Product is not in transit");
        require(products[_uid].pendingRecipient == msg.sender, "You are not the recipient");
        
        address previousOwner = products[_uid].currentOwner;
        uint256 index = ownerProductIndexes[previousOwner][_uid];
        uint256 lastIndex = ownerProducts[previousOwner].length - 1;
        
        if (index != lastIndex) {
            string memory lastUid = ownerProducts[previousOwner][lastIndex];
            ownerProducts[previousOwner][index] = lastUid;
            ownerProductIndexes[previousOwner][lastUid] = index;
        }
        
        ownerProducts[previousOwner].pop();
        delete ownerProductIndexes[previousOwner][_uid];
        
        products[_uid].currentOwner = msg.sender;
        products[_uid].inTransit = false;
        products[_uid].pendingRecipient = address(0);
        ownerProducts[msg.sender].push(_uid);
        ownerProductIndexes[msg.sender][_uid] = ownerProducts[msg.sender].length - 1;
        
        emit TransferCompleted(_uid, previousOwner, msg.sender);
        return true;
    }

    //  products owned by an address
    function getOwnerProductCount(address _owner) public view returns (uint256) {
        return ownerProducts[_owner].length;
    }

    function getOwnerProductAt(address _owner, uint256 _index) public view returns (string memory) {
        require(_index < ownerProducts[_owner].length, "Index out of bounds");
        return ownerProducts[_owner][_index];
    }

    // Get all product UIDs for an owner 
    function getOwnerProducts(address _owner, uint256 _offset, uint256 _limit) public view returns (string[] memory) {
        uint256 total = ownerProducts[_owner].length;
        if (_offset >= total) {
            return new string[](0);
        }
        
        uint256 end = _offset + _limit;
        if (end > total) {
            end = total;
        }
        
        string[] memory result = new string[](end - _offset);
        for (uint256 i = _offset; i < end; i++) {
            result[i - _offset] = ownerProducts[_owner][i];
        }
        
        return result;
    }

    // Check if product exists
    function productExists(string memory _uid) public view returns (bool) {
        return products[_uid].currentOwner != address(0);
    }

    //  product is expired
    function isProductExpired(string memory _uid) public view returns (bool) {
        require(products[_uid].currentOwner != address(0), "Product does not exist");
        return block.timestamp > products[_uid].expiryTimestamp;
    }
}