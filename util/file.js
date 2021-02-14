const deleteImage = async (storage, bucketName, fileName) => {
  try {
    await storage.bucket(bucketName).file(fileName).delete();
    console.log("Image Deleted.");
  } catch {
    console.log("Cannot delete image.");
  }
};

const uploadImage = (file, blob) => {
  const blobStream = blob.createWriteStream({
    resumable: false,
  });

  blobStream.on("error", (err) => {
    next(err);
  });

  blobStream.on("finish", () => {
    console.log("Image Uploaded");
  });

  blobStream.end(file.buffer);
};

exports.deleteImage = deleteImage;
exports.uploadImage = uploadImage;
