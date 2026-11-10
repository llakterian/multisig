const { ethers } = require("hardhat");

function getRoleWallet(roleEnv, deployer) {
  const pk = process.env[roleEnv];
  if (pk) {
    return new ethers.Wallet(pk, ethers.provider);
  }
  return deployer;
}

async function main() {
  console.log("Deploying Notary-Mediated Escrow System...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH\n");

  // Role-based signers (env overrides; fallback to deployer for local/single-key testing)
  const notaryWallet = getRoleWallet("NOTARY_PRIVATE_KEY", deployer);
  const treasuryWallet = getRoleWallet("TREASURY_PRIVATE_KEY", deployer);
  const sellerWallet = getRoleWallet("SELLER_PRIVATE_KEY", deployer);

  const doddyNotary = notaryWallet.address;
  const sizlandTreasury = treasuryWallet.address;
  const testSeller = sellerWallet.address;

  const defaultOwners = [
    deployer.address,
    doddyNotary,
    sizlandTreasury
  ];
  const numConfirmationsRequired = 2;

  // Deploy MultiSigWallet
  console.log("Step 1: Deploying MultiSigWallet...");
  const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
  const multiSigWallet = await MultiSigWallet.deploy(defaultOwners, numConfirmationsRequired);
  await multiSigWallet.deployed();
  console.log("MultiSigWallet deployed to:", multiSigWallet.address);

  // Deploy NotaryMediatedEscrow
  console.log("\nStep 2: Deploying NotaryMediatedEscrow...");
  const NotaryMediatedEscrow = await ethers.getContractFactory("NotaryMediatedEscrow");
  const notaryMediatedEscrow = await NotaryMediatedEscrow.deploy(
    defaultOwners,
    numConfirmationsRequired,
    sizlandTreasury,
    deployer.address // factory
  );
  await notaryMediatedEscrow.deployed();
  console.log("NotaryMediatedEscrow deployed to:", notaryMediatedEscrow.address);

  // Deploy EscrowFactory
  console.log("\nStep 3: Deploying EscrowFactory...");
  const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
  const escrowFactory = await EscrowFactory.deploy(
    doddyNotary,
    defaultOwners,
    numConfirmationsRequired,
    sizlandTreasury
  );
  await escrowFactory.deployed();
  console.log("EscrowFactory deployed to:", escrowFactory.address);

  // Create a test escrow
  console.log("\nStep 4: Creating test escrow contract...");
  const testAmount = ethers.utils.parseEther("5.0");
  const createTx = await escrowFactory.connect(deployer).createEscrowWithDefaultNotary(
    deployer.address, // client
    testSeller,
    testAmount
  );
  const receipt = await createTx.wait();
  const escrowCreatedEvent = receipt.events.find(e => e.event === "EscrowCreated");
  const testEscrowAddress = escrowCreatedEvent.args.escrowContract;
  console.log("Test escrow contract deployed at:", testEscrowAddress);

  // Executing full workflow
  console.log("\nStep 5: Executing full end-to-end workflow...");
  const testEscrow = await ethers.getContractAt("NotaryMediatedEscrow", testEscrowAddress);

  // 5.1: Intake (client = deployer)
  console.log("  5.1: Creating intake (Phase 1)...");
  await (await testEscrow.connect(deployer).createIntake(
    testAmount,
    1,
    "Farming",
    testSeller,
    doddyNotary
  )).wait();

  // 5.2: Discovery (notary uploads gallery; client selects plot)
  console.log("  5.2: Uploading gallery & Selecting plot (Phase 2)...");
  await (await testEscrow.connect(notaryWallet).uploadDigitalGallery(0)).wait();
  await (await testEscrow.connect(deployer).selectPlot(0)).wait();

  // 5.3: Funding (client funds escrow)
  console.log("  5.3: Funding escrow (Phase 3)...");
  await (await testEscrow.connect(deployer).fundEscrow(0, true, { value: testAmount })).wait();

  // 5.4: Due Diligence (notary uploads docs; client verifies)
  console.log("  5.4: Performing Due Diligence...");
  const reportHash = ethers.utils.id("DD Report");
  const searchHash = ethers.utils.id("Search Certificate");

  await (await testEscrow.connect(notaryWallet).uploadDocument(0, 1, reportHash)).wait(); // DueDiligenceReport
  await (await testEscrow.connect(notaryWallet).uploadDocument(0, 0, searchHash)).wait(); // SearchCertificate

  console.log("    Verifying documents as client...");
  await (await testEscrow.connect(deployer).verifyDocument(0, 1)).wait(); // DueDiligenceReport
  await (await testEscrow.connect(deployer).verifyDocument(0, 0)).wait(); // SearchCertificate

  // 5.5: Negotiation (notary sets rates)
  console.log("  5.5: Notary setting negotiated rates...");
  await (await testEscrow.connect(notaryWallet).setNegotiatedRates(0, 1500, 300)).wait();

  // Get status
  const escrowDetails = await testEscrow.escrows(0);
  console.log("\nTest Escrow Final Status:");
  console.log("  State (Enum Index):", escrowDetails.state);
  console.log("  Deposit Amount:", ethers.utils.formatEther(escrowDetails.depositAmount), "ETH");
  console.log("  Facilitation Fee:", ethers.utils.formatEther(escrowDetails.facilitationFee), "ETH");
  console.log("  Final Balance:", ethers.utils.formatEther(escrowDetails.finalAmount), "ETH");

  console.log("\nExecution completed successfully!");
  console.log("\nDeployed addresses:");
  console.log("  MultiSigWallet:", multiSigWallet.address);
  console.log("  NotaryMediatedEscrow:", notaryMediatedEscrow.address);
  console.log("  EscrowFactory:", escrowFactory.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nERROR during execution:", error);
    process.exit(1);
  });
