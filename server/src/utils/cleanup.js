const fs = require('fs').promises;

/**
 * Remove one or more files safely.
 * @param {string|string[]} filePaths
 */
async function cleanupFiles(filePaths) {
  const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
  for (const filePath of paths) {
    if (!filePath) continue;
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // Ignore ENOENT (file not found), log other warnings
      if (err.code !== 'ENOENT') {
        console.warn(`[Cleanup Warning] Could not delete file ${filePath}:`, err.message);
      }
    }
  }
}

module.exports = {
  cleanupFiles,
};
