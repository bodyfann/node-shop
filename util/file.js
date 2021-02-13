const fs = require("fs");

const deleteFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) {
        throw new Error("Something bad happened deleting the old image.");
      }
    });
  }
};

exports.deleteFile = deleteFile;
