import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Upload, X, Image, Loader2, ZoomIn } from 'lucide-react';

const AssetPhotoGallery = ({ assetId, canEdit = false }) => {
  const [photos, setPhotos]       = useState([]);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox]   = useState(null);
  const fileInputRef              = useRef(null);

  useEffect(() => {
    if (assetId) fetchPhotos();
  }, [assetId]);

  const fetchPhotos = async () => {
    try {
      const res = await api.get(`/photos/${assetId}`);
      setPhotos(res.data);
    } catch (err) {
      console.error('fetch photos error:', err);
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > 3 * 1024 * 1024) {
          alert(`ไฟล์ ${file.name} ใหญ่เกิน 3MB`);
          continue;
        }
        const formData = new FormData();
        formData.append('photo', file);
        await api.post(`/photos/${assetId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      fetchPhotos();
      fileInputRef.current.value = '';
    } catch (err) {
      alert('อัปโหลดไม่สำเร็จ: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photoId, fileName) => {
    if (!window.confirm(`ลบรูป "${fileName}" ใช่ไหม?`)) return;
    try {
      await api.delete(`/photos/photo/${photoId}`);
      fetchPhotos();
    } catch (err) {
      alert('ลบไม่สำเร็จ: ' + (err.response?.data?.error || err.message));
    }
  };

  if (!assetId) return null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Image size={14} className="text-blue-500" />
          รูปภาพ
          <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{photos.length}</span>
        </div>
        {canEdit && (
          <>
            <input ref={fileInputRef} type="file" multiple accept="image/*"
              onChange={handleUpload} className="hidden" />
            <button
              onClick={() => fileInputRef.current.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {uploading
                ? <><Loader2 size={12} className="animate-spin" /> กำลังอัปโหลด...</>
                : <><Upload size={12} /> เพิ่มรูป</>}
            </button>
          </>
        )}
      </div>

      {/* Photos grid */}
      {photos.length === 0 ? (
        <div className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-lg">
          ยังไม่มีรูปภาพ{canEdit && ' — กดปุ่ม "เพิ่มรูป" เพื่ออัปโหลด'}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {photos.map(photo => (
            <div key={photo.Id} className="relative group w-20 h-20">
              <img
                src={`http://localhost:5000${photo.FilePath}`}
                alt={photo.FileName}
                onClick={() => setLightbox(photo)}
                className="w-20 h-20 object-cover rounded-lg border border-gray-200 cursor-zoom-in hover:opacity-90 transition-opacity"
                onError={e => {
                  e.target.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23eee" width="80" height="80"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999" font-size="20">?</text></svg>`;
                }}
              />
              {/* Zoom overlay */}
              <div className="absolute inset-0 bg-black/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <ZoomIn size={16} className="text-white" />
              </div>
              {/* Delete button */}
              {canEdit && (
                <button
                  onClick={() => handleDelete(photo.Id, photo.FileName)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-[9999] cursor-zoom-out p-4"
        >
          <div onClick={e => e.stopPropagation()} className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={`http://localhost:5000${lightbox.FilePath}`}
              alt={lightbox.FileName}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="absolute -bottom-7 left-0 right-0 text-center text-xs text-gray-400">
              {lightbox.FileName}
              {lightbox.FileSize && ` (${Math.round(lightbox.FileSize / 1024)} KB)`}
            </div>
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow-lg"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetPhotoGallery;