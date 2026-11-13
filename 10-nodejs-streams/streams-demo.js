// Streams process data chunk by chunk instead of loading everything into memory.

// 1. Readable: Read data.
// 2. Writable: Write data.
// 3. Duplex: Read and write data. (TCP socket)
// 4. Transform: Read, modify and write data. (Gzip, encryption)

const fs = require("fs"); // Read and write files.
const zlib = require("zlib"); // Compress and decompress data.
const crypto = require("crypto"); // Encrypt and decrypt data.

// Generate encryption key and IV
const key = crypto.randomBytes(32); // Secret encryption key (32 bytes = 256 bits).
const iv = crypto.randomBytes(16); // Initialization Vector (16 bytes for AES-CBC).

// Create encryption stream
const encryptStream = crypto.createCipheriv("aes-256-cbc", key, iv);

// Create streams
const readStream = fs.createReadStream("input.txt");
const gzipStream = zlib.createGzip(); // Compresses incoming data using Gzip.
const writeStream = fs.createWriteStream("output.txt.gz.enc");

// Connect streams using pipe()
// Read → Compress → Encrypt → Write
readStream.pipe(gzipStream).pipe(encryptStream).pipe(writeStream);
// pipe() connects streams and passes data from one stream to another.

// Runs when writing is completed.
writeStream.on("finish", () => {
  console.log("File compressed and encrypted successfully!");
});
