# Sizland Land Acquisition - UI Testing Guide

This guide will help you test the end-to-end 4-phase land purchase workflow using the React frontend and MetaMask.

## Prerequisites
1. **MetaMask Extension**: Installed in your browser.
2. **Node.js & NPM**: Installed on your system.
3. **Hardhat Node**: Should be running locally.

---

## Step 1: Initialize the Environment

### 1.1 Start the Hardhat Node
Open a terminal and run:
```bash
cd /home/c0bw3b/multisig
npx hardhat node
```
*Note: Keep this terminal open.*

### 1.2 Deploy the Smart Contracts
In a new terminal, run:
```bash
cd /home/c0bw3b/multisig
npx hardhat run scripts/deploy.js --network localhost
```
*Wait for the deployment to finish and take note of the contract addresses.*

### 1.3 Start the Frontend
In the same terminal (or a new one), run:
```bash
cd /home/c0bw3b/multisig
npm start
```
The app should now be running at `http://localhost:3000`.

---

## Step 2: Configure MetaMask

### 2.1 Add Local Network
1. Open MetaMask.
2. Click the Network Selector (top left).
3. Click "Add Network" -> "Add a network manually".
4. Enter the following details:
   - **Network Name**: Hardhat Local
   - **New RPC URL**: `http://127.0.0.1:8545`
   - **Chain ID**: `1337` (or `31337` depending on config, check Hardhat output)
   - **Currency Symbol**: ETH
5. Click "Save" and switch to this network.

### 2.2 Import Test Accounts
The Hardhat node provides 20 accounts with 10000 ETH each. We need to import at least three:

1. **Client (Account #0)**:
   - Private Key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
2. **Notary/Doddy (Account #1)**:
   - Address: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
   - Private Key: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
3. **Treasury (Account #2)**:
   - Address: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`
   - Private Key: `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a`

---

## Step 3: End-to-End Workflow Testing

### Phase 1: Intake & Discovery (As Client)
1. Navigate to `http://localhost:3000`.
2. Connect MetaMask and select the **Client** account.
3. Fill in the intake form (Budget, Desired Size, Purpose).
4. Click "Submit Intake".
5. Wait for Phase 2 (Discovery) to activate.

### Phase 2: Discovery & Selection (As Treasury & Client)
1. Switch MetaMask account to **Treasury**.
2. Refresh the page or wait for the UI to update.
3. Upload Digital Gallery (Mock pins/photos).
4. Switch MetaMask back to **Client**.
5. View the gallery and click "Select This Plot".
6. Wait for Phase 3 (Safety Gate).

### Phase 3: Safety Gate & Funding (As Client & Notary)
1. As **Client**, click "Fund Full Amount" (5 ETH).
2. Switch MetaMask to **Notary**.
3. Upload Due Diligence Report and Registry Search.
4. Switch back to **Client**.
5. Verify both documents by clicking "Verify".
6. The Notary can now click "Set Negotiated Rates" to adjust the deposit/fee percentages.
7. Click "Proceed with Purchase".

### Phase 4: Execution & Finalization (As Notary)
1. As **Notary**, click "Execute Fiat Bridge" (Simulates conversion to KES).
2. Provide exchange rate and KES amount.
3. Upload Lodgement Receipt.
4. Finally, click "Complete Transfer" once the title is ready.
5. Provide Courier Tracking number.

**Workflow Complete! 🚀**
