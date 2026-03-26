import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function Gallery() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    api.get('/gallery').then(r => setPhotos(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex-center" style={{ height: '60vh' }}><span className="spinner" /></div>
  );

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, var(--navy) 0%, var(--blue-700) 100%)',
        color: '#fff', padding: '3rem 1rem 2.5rem', textAlign: 'center'
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>📸</div>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, color: '#fff' }}>Our Work</h1>
        <p style={{ opacity: .85, maxWidth: 480, margin: '.5rem auto 0', fontSize: '1rem' }}>
          See examples of the quality lawn care and snow removal services we provide.
        </p>
      </div>

      <div className="container" style={{ padding: '2.5rem 1rem' }}>
        {photos.length === 0 ? (
          <div className="card text-center" style={{ padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌿</div>
            <h2 style={{ color: 'var(--gray-500)', fontWeight: 500 }}>No photos yet</h2>
            <p style={{ color: 'var(--gray-400)', marginTop: '.5rem' }}>Check back soon — we're adding photos of our work!</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1.25rem'
          }}>
            {photos.map(photo => (
              <div
                key={photo.id}
                className="card"
                style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', transition: 'transform .2s, box-shadow .2s' }}
                onClick={() => setLightbox(photo)}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{ aspectRatio: '4/3', overflow: 'hidden', background: 'var(--gray-100)' }}>
                  <img
                    src={photo.file_path}
                    alt={photo.caption || 'Work photo'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform .3s' }}
                    onMouseEnter={e => e.target.style.transform = 'scale(1.04)'}
                    onMouseLeave={e => e.target.style.transform = ''}
                  />
                </div>
                {(photo.caption || photo.description) && (
                  <div style={{ padding: '.85rem 1rem' }}>
                    {photo.caption && <div style={{ fontWeight: 600, fontSize: '.92rem' }}>{photo.caption}</div>}
                    {photo.description && <div style={{ fontSize: '.82rem', color: 'var(--gray-500)', marginTop: '.2rem' }}>{photo.description}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, padding: '1rem', cursor: 'pointer'
          }}
          onClick={() => setLightbox(null)}
        >
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightbox(null)}
              style={{
                position: 'absolute', top: -14, right: -14, background: '#fff',
                border: 'none', borderRadius: '50%', width: 32, height: 32,
                fontSize: '1.1rem', cursor: 'pointer', zIndex: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'var(--shadow-md)'
              }}
            >×</button>
            <img
              src={lightbox.file_path}
              alt={lightbox.caption || 'Work photo'}
              style={{ maxWidth: '85vw', maxHeight: '80vh', borderRadius: 8, display: 'block', objectFit: 'contain' }}
            />
            {(lightbox.caption || lightbox.description) && (
              <div style={{ background: 'rgba(255,255,255,.95)', padding: '.75rem 1rem', borderRadius: '0 0 8px 8px' }}>
                {lightbox.caption && <div style={{ fontWeight: 700 }}>{lightbox.caption}</div>}
                {lightbox.description && <div style={{ fontSize: '.85rem', color: 'var(--gray-600)', marginTop: '.2rem' }}>{lightbox.description}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
