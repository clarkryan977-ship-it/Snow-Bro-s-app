/**
 * Cloudinary upload utility for Snow Bro's
 *
 * All photo uploads (gallery, before/after, job photos) go through this module.
 * If CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are set,
 * files are uploaded to Cloudinary and the returned secure_url is stored in the DB.
 * If the env vars are missing (local dev), falls back to local disk storage.
 */
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const CLOUD_CONFIGURED =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (CLOUD_CONFIGURED) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
  console.log('[Cloudinary] Configured — uploads will go to Cloudinary');
} else {
  console.warn('[Cloudinary] NOT configured — falling back to local disk storage');
}

/**
 * Create a multer instance that uploads to Cloudinary (or local disk as fallback).
 *
 * @param {string} folder  Cloudinary folder name, e.g. 'snowbros/gallery'
 * @param {string} localSubdir  Local subdirectory under UPLOADS_ROOT, e.g. 'gallery'
 * @param {number} maxSizeMB  Max file size in MB (default 15)
 * @returns multer instance
 */
function makeUploader(folder, localSubdir, maxSizeMB = 15) {
  if (CLOUD_CONFIGURED) {
    const storage = new CloudinaryStorage({
      cloudinary,
      params: {
        folder,
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [{ quality: 'auto', fetch_format: 'auto' }]
      }
    });
    return multer({
      storage,
      limits: { fileSize: maxSizeMB * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) cb(null, true);
        else cb(new Error('Only image files are allowed'));
      }
    });
  }

  // Local disk fallback
  const uploadDir = path.join(
    process.env.UPLOADS_ROOT || path.join(__dirname, '../uploads'),
    localSubdir
  );
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`)
  });
  return multer({
    storage,
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) cb(null, true);
      else cb(new Error('Only image files are allowed'));
    }
  });
}

/**
 * Extract the public URL and filename from a multer file object.
 * Works for both Cloudinary uploads (req.file.path = secure_url) and local disk.
 *
 * @param {object} file  req.file from multer
 * @param {string} localSubdir  e.g. 'gallery'
 * @returns {{ url: string, filename: string }}
 */
function getFileInfo(file, localSubdir) {
  if (CLOUD_CONFIGURED) {
    // Cloudinary: file.path = secure_url, file.filename = public_id
    return {
      url: file.path,           // e.g. https://res.cloudinary.com/...
      filename: file.filename   // public_id
    };
  }
  // Local disk: build relative URL
  return {
    url: `/uploads/${localSubdir}/${file.filename}`,
    filename: file.filename
  };
}

/**
 * Delete a file from Cloudinary (or local disk).
 * @param {string} filename  public_id (Cloudinary) or bare filename (local)
 * @param {string} localSubdir  e.g. 'gallery'
 */
async function deleteFile(filename, localSubdir) {
  if (CLOUD_CONFIGURED) {
    try {
      await cloudinary.uploader.destroy(filename);
    } catch (e) {
      console.warn('[Cloudinary] delete error:', e.message);
    }
    return;
  }
  const fullPath = path.join(
    process.env.UPLOADS_ROOT || path.join(__dirname, '../uploads'),
    localSubdir,
    filename
  );
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

module.exports = { makeUploader, getFileInfo, deleteFile, CLOUD_CONFIGURED };
