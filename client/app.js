let web3;
let inventoryContract;
let userAccount;
const contractAddress = ""; //fill Hash Address obtained from truffle migrate  

const contractABI = [] //fill the Contract abi obtained after truffle compile from build/InventorySystem.json 

// Initialize the application
window.addEventListener('load', async function() {
    // Check if QRCode library is loaded
    if (typeof QRCode === 'undefined') {
        console.error("QRCode library not loaded");
        alert("QRCode library not loaded. Please check your internet connection and reload the page.");
        return;
    }
    
    // Check if Web3 is injected
    if (window.ethereum) {
        try {
            // Request account access
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            web3 = new Web3(window.ethereum);
            
            // Get user account
            const accounts = await web3.eth.getAccounts();
            userAccount = accounts[0];
            
            // Initialize contract
            inventoryContract = new web3.eth.Contract(contractABI, contractAddress);
            
            console.log('Connected to MetaMask', userAccount);
            loadUserProducts();
            
            // Handle account changes
            window.ethereum.on('accountsChanged', (accounts) => {
                userAccount = accounts[0];
                loadUserProducts();
            });
        } catch (error) {
            console.error("User denied account access:", error);
            alert("Please allow MetaMask access to use this application");
        }
    } else {
        alert("Please install MetaMask to use this application");
    }
    
    // Set up form listeners
    document.getElementById('registerForm').addEventListener('submit', registerProduct);
    document.getElementById('transferForm').addEventListener('submit', initiateTransfer);
    document.getElementById('receiveForm').addEventListener('submit', confirmReceipt);
    document.getElementById('refreshProducts').addEventListener('click', loadUserProducts);
    document.getElementById('startScan').addEventListener('click', startQRScanner);
    document.getElementById('printQR').addEventListener('click', printQRCode);
});

// Tab navigation
function openTab(tabName) {
    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove('active');
    }
    
    const tabButtons = document.getElementsByClassName('tab-btn');
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove('active');
    }
    
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

// Register product function
async function registerProduct(event) {
    event.preventDefault();
    
    const uid = document.getElementById('uid').value || generateUID();
    const name = document.getElementById('name').value;
    const category = document.getElementById('category').value;
    const quantity = document.getElementById('quantity').value;
    const unit = document.getElementById('unit').value;
    const productionDate = new Date(document.getElementById('productionDate').value).getTime() / 1000;
    const shelfLife = document.getElementById('shelfLife').value;
    const storageRequirements = document.getElementById('storageRequirements').value;
    
    try {
        // Show loading state
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering...';
        
        const result = await inventoryContract.methods.registerProduct(
            uid, name, category, quantity, unit, productionDate, shelfLife, storageRequirements
        ).send({ from: userAccount });
        
        document.getElementById('resultContent').innerHTML = `
            <p>Product registered successfully!</p>
            <p>UID: ${uid}</p>
            <p>Transaction Hash: ${result.transactionHash}</p>
        `;
        
        // Generate QR code - FIXED VERSION
        try {
            const qrElement = document.getElementById('qrcode');
            qrElement.innerHTML = '';
            
            if (typeof QRCode !== 'undefined') {
                new QRCode(qrElement, {
                    text: uid,
                    width: 200,
                    height: 200,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
                document.getElementById('printQR').style.display = 'block';
            } else {
                console.error("QRCode library not properly loaded");
                qrElement.innerHTML = '<p>QR code generation unavailable</p>';
            }
        } catch (qrError) {
            console.error("QR code generation error:", qrError);
            document.getElementById('qrcode').innerHTML = '<p>Error generating QR code</p>';
        }
        
        loadUserProducts();
    } catch (error) {
        console.error("Registration error:", error);
        document.getElementById('resultContent').innerHTML = `
            <p>Error registering product: ${error.message.split('\n')[0]}</p>
        `;
    } finally {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register Product';
    }
}

// Load user products
async function loadUserProducts() {
    try {
        const productCount = await inventoryContract.methods.getOwnerProductCount(userAccount).call();
        const tableBody = document.getElementById('productsTableBody');
        tableBody.innerHTML = '';
        
        if (productCount === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No products found</td></tr>';
            return;
        }
        
        for (let i = 0; i < productCount; i++) {
            const uid = await inventoryContract.methods.getOwnerProductAt(userAccount, i).call();
            const product = await inventoryContract.methods.getProduct(uid).call();
            
            const row = document.createElement('tr');
            const expiryDate = new Date(product.expiryTimestamp * 1000).toLocaleDateString();
            const status = product.inTransit ? 'In Transit' : 'Available';
            
            row.innerHTML = `
                <td>${uid}</td>
                <td>${product.name}</td>
                <td>${product.quantity} ${product.unit}</td>
                <td>${expiryDate}</td>
                <td>${status}</td>
                <td>
                    <button onclick="showProductDetails('${uid}')">Details</button>
                    ${status === 'Available' ? `<button onclick="prepareTransfer('${uid}')">Transfer</button>` : ''}
                </td>
            `;
            
            tableBody.appendChild(row);
        }
    } catch (error) {
        console.error("Error loading products:", error);
        document.getElementById('productsTableBody').innerHTML = `
            <tr><td colspan="6" style="text-align:center;color:red;">Error loading products</td></tr>
        `;
    }
}

// Show product details
async function showProductDetails(uid) {
    try {
        const product = await inventoryContract.methods.getProduct(uid).call();
        const productionDate = new Date(product.productionTimestamp * 1000).toLocaleDateString();
        const expiryDate = new Date(product.expiryTimestamp * 1000).toLocaleDateString();
        
        alert(`
            Product Details:
            Name: ${product.name}
            Category: ${product.category}
            Quantity: ${product.quantity} ${product.unit}
            Production Date: ${productionDate}
            Shelf Life: ${product.shelfLifeDays} days
            Expiry Date: ${expiryDate}
            Storage: ${product.storageRequirements}
            Status: ${product.inTransit ? 'In Transit' : 'Available'}
        `);
    } catch (error) {
        console.error("Error getting product details:", error);
        alert("Error loading product details");
    }
}

// Prepare transfer form
function prepareTransfer(uid) {
    document.getElementById('transferUid').value = uid;
    openTab('transfer');
}

// Initiate transfer
async function initiateTransfer(event) {
    event.preventDefault();
    
    const uid = document.getElementById('transferUid').value;
    const recipientAddress = document.getElementById('recipientAddress').value;
    
    try {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
        
        const result = await inventoryContract.methods.initiateTransfer(uid, recipientAddress)
            .send({ from: userAccount });
        
        document.getElementById('transferResult').innerHTML = `
            <p>Transfer initiated successfully!</p>
            <p>UID: ${uid}</p>
            <p>Recipient: ${recipientAddress}</p>
            <p>Transaction Hash: ${result.transactionHash}</p>
        `;
        
        loadUserProducts();
    } catch (error) {
        console.error("Transfer error:", error);
        document.getElementById('transferResult').innerHTML = `
            <p>Error initiating transfer: ${error.message.split('\n')[0]}</p>
        `;
    } finally {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Initiate Transfer';
    }
}

// Confirm receipt
async function confirmReceipt(event) {
    event.preventDefault();
    
    const uid = document.getElementById('receiveUid').value;
    
    try {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Confirming...';
        
        const result = await inventoryContract.methods.confirmReceived(uid)
            .send({ from: userAccount });
        
        document.getElementById('receiveResult').innerHTML = `
            <p>Receipt confirmed successfully!</p>
            <p>UID: ${uid}</p>
            <p>Transaction Hash: ${result.transactionHash}</p>
        `;
        
        loadUserProducts();
    } catch (error) {
        console.error("Receipt confirmation error:", error);
        document.getElementById('receiveResult').innerHTML = `
            <p>Error confirming receipt: ${error.message.split('\n')[0]}</p>
        `;
    } finally {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm Receipt';
    }
}

// QR code scanner
function startQRScanner() {
    const video = document.getElementById('qrScanner');
    video.style.display = 'block';
    document.getElementById('startScan').style.display = 'none';
    
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(function(stream) {
            video.srcObject = stream;
            video.play();
            
            // In a real app, you would process frames with a QR library
            setTimeout(() => {
                alert("QR scanner placeholder - would decode QR codes in a real implementation");
                stopScanner();
            }, 3000);
        })
        .catch(function(error) {
            console.error("Camera error:", error);
            alert("Could not access camera. Please enter UID manually.");
            stopScanner();
        });
}

function stopScanner() {
    const video = document.getElementById('qrScanner');
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    video.style.display = 'none';
    document.getElementById('startScan').style.display = 'block';
}

// Print QR code
function printQRCode() {
    const printWindow = window.open('', '', 'height=600,width=600');
    printWindow.document.write('<html><head><title>Product QR Code</title></head><body>');
    printWindow.document.write('<h2>Product QR Code</h2>');
    printWindow.document.write(document.getElementById('qrcode').outerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

// Generate UID
function generateUID() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${timestamp.substring(timestamp.length - 6)}-${random}`;
}
// Add this to your app.js
document.getElementById('processCSV').addEventListener('click', processCSVFile);

async function processCSVFile() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a CSV file first');
        return;
    }

    try {
        const csvData = await readCSVFile(file);
        const parsedData = parseCSVData(csvData);
        await registerProductsFromCSV(parsedData);
    } catch (error) {
        console.error("CSV processing error:", error);
        document.getElementById('resultContent').innerHTML = `
            <p>Error processing CSV: ${error.message}</p>
        `;
    }
}

function readCSVFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            resolve(event.target.result);
        };
        
        reader.onerror = (error) => {
            reject(error);
        };
        
        reader.readAsText(file);
    });
}

function parseCSVData(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Expected CSV format:
    // UID,Name,Category,Quantity,Unit,ProductionDate,ShelfLifeDays,StorageRequirements
    const expectedHeaders = ['uid', 'name', 'category', 'quantity', 'unit', 'productiondate', 'shelflifedays', 'storagerequirements'];
    
    // Validate headers
    if (headers.length !== expectedHeaders.length || 
        !headers.every((h, i) => h.toLowerCase() === expectedHeaders[i])) {
        throw new Error('Invalid CSV format. Please use the correct headers.');
    }
    
    const products = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        
        const values = lines[i].split(',');
        if (values.length !== headers.length) continue;
        
        // Parse production date to timestamp
        const productionDate = new Date(values[5].trim());
        const productionTimestamp = Math.floor(productionDate.getTime() / 1000);
        
        products.push({
            uid: values[0].trim(),
            name: values[1].trim(),
            category: values[2].trim(),
            quantity: parseInt(values[3].trim()),
            unit: values[4].trim(),
            productionTimestamp: productionTimestamp,
            shelfLifeDays: parseInt(values[6].trim()),
            storageRequirements: values[7].trim()
        });
    }
    
    return products;
}

async function registerProductsFromCSV(products) {
    try {
        // Prepare arrays for batch registration
        const uids = [];
        const names = [];
        const categories = [];
        const quantities = [];
        const units = [];
        const productionTimestamps = [];
        const shelfLifeDays = [];
        const storageRequirements = [];
        
        products.forEach(product => {
            uids.push(product.uid);
            names.push(product.name);
            categories.push(product.category);
            quantities.push(product.quantity);
            units.push(product.unit);
            productionTimestamps.push(product.productionTimestamp);
            shelfLifeDays.push(product.shelfLifeDays);
            storageRequirements.push(product.storageRequirements);
        });
        
        // Call the batch registration function
        const result = await inventoryContract.methods.batchRegisterProducts(
            uids,
            names,
            categories,
            quantities,
            units,
            productionTimestamps,
            shelfLifeDays,
            storageRequirements
        ).send({ from: userAccount });
        
        document.getElementById('resultContent').innerHTML = `
            <p>Successfully registered ${products.length} products from CSV!</p>
            <p>Transaction Hash: ${result.transactionHash}</p>
        `;
        
        loadUserProducts();
    } catch (error) {
        console.error("Batch registration error:", error);
        throw error;
    }
}