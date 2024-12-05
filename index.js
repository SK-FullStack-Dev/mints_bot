require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const app = express();
const port = 5001;
const axios = require('axios');
const ethers = require('ethers');
const abi = require('./abi.json');

// Web3 Configuration
const provider = new ethers.JsonRpcProvider('https://eth-mainnet.g.alchemy.com/v2/ngGcydhhMHgnUG8uThMl7osVVVOM0u1S');
const contractAddress = '0xB09F884d48543ee12Ebbeb0E565FdECc8077EC32';
const contractABI = abi;
const contract = new ethers.Contract(contractAddress, contractABI, provider);

// Telegram Bot Token from .env
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = "-1002208114498"; // Add this to your .env file

// Create Telegram Bot Instance
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Create a Set to track processed transaction hashes
const processedTransactions = new Set();

// Express Middleware
app.use(express.json());

// Webhook Endpoint
app.post("/webhook", async (req, res) => {
  try {
    const webhook = req.body;

    // Process each NFT transfer
    for (const nftTransfer of webhook.nftTransfers) {
      // Check if this transaction has already been processed
      if (processedTransactions.has(nftTransfer.transactionHash)) {
        console.log(`Duplicate transaction detected: ${nftTransfer.transactionHash}`);
        continue; // Skip this iteration
      }

      // Add the transaction hash to processed set
      processedTransactions.add(nftTransfer.transactionHash);

      // Remove old transaction hashes to prevent memory buildup
      if (processedTransactions.size > 1000) {
        const oldestHash = Array.from(processedTransactions)[0];
        processedTransactions.delete(oldestHash);
      }

      // Format addresses for readability
      const fromAddress = `From address: ${nftTransfer.from.slice(0, 4)}...${nftTransfer.from.slice(38)}`;
      const toAddress = `To address: ${nftTransfer.to.slice(0, 4)}...${nftTransfer.to.slice(38)}`;
      const tokenItem = `Token Item: ${nftTransfer.tokenName} #${nftTransfer.tokenId}`;
      const transactionHash = `Transaction Hash: ${nftTransfer.transactionHash}`;

      // Construct metadata URI (adjust as needed for your specific setup)
      const uri = `https://arweave.net/8B9-TeDlvnAMAfipLL0lRifAc1xMoYajpkgFJHXvRyY/${nftTransfer.tokenId}.json`;

      try {
        // Fetch NFT Metadata
        const response = await axios.get(uri);
        const jsonData = response.data;

        // Destructure metadata (adjust based on your exact JSON structure)
        const {
          name,
          description,
          image,
          attributes
        } = jsonData;

        // Process attributes (adjust based on your specific attributes)
        const attributesText = attributes 
          ? attributes.map(attr => `${attr.trait_type}: ${attr.value}`).join('\n')
          : 'No attributes';

        // Construct caption
        const caption = 
          '🔥 Frog Soup ' +
          `${name} `  + 
          'just got served! 🐸🍲\n' +
          `\n${attributesText} \n\n` +
          `Transaction Hash: https://etherscan.io/tx/${nftTransfer.transactionHash} \n\n` +
          `🐸🍲 Mint Frog Soup: https://www.frogsoupcafe.fun/`;

        // Send photo with caption
        await bot.sendPhoto(CHAT_ID, image, {
          caption: caption,
          parse_mode: 'Markdown'
        });

      } catch (metadataError) {
        console.error('Error processing NFT metadata:', metadataError);
        
        // Optional: Send error notification to Telegram
        await bot.sendMessage(CHAT_ID, `Error processing NFT ${nftTransfer.tokenId}: ${metadataError.message}`);
      }
    }

    // Respond to webhook
    return res.status(200).json({ status: 'processed' });

  } catch (webhookError) {
    console.error('Webhook processing error:', webhookError);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Start Express Server
app.listen(port, () => {
  console.log(`Listening for NFT Transfers on port ${port}`);
});