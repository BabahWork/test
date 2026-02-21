const API_KEY = '04a9f4052def61c0ac00f470cfee5935';
let selectedFiles = [];
let isAlbumMode = false;
let currentLightboxImages = [];
let currentLightboxIndex = 0;

window.revealImage = (img) => {
    img.classList.add('ready');
    img.parentElement.classList.add('loaded');
};

const btnSingle = document.getElementById('modeSingle');
const btnAlbum = document.getElementById('modeAlbum');
const albumTitleInput = document.getElementById('albumTitle');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const searchInput = document.getElementById('searchInput');
const compressCheckbox = document.getElementById('compressImages');
const compressionQuality = document.getElementById('compressionQuality');

btnSingle.onclick = () => {
    isAlbumMode = false;
    btnSingle.classList.add('active');
    btnAlbum.classList.remove('active');
    albumTitleInput.style.display = 'none';
};

btnAlbum.onclick = () => {
    isAlbumMode = true;
    btnAlbum.classList.add('active');
    btnSingle.classList.remove('active');
    albumTitleInput.style.display = 'block';
};

dropZone.onclick = () => fileInput.click();

async function compressImage(file, quality) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                const maxSize = 2048;
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = (height / width) * maxSize;
                        width = maxSize;
                    } else {
                        width = (width / height) * maxSize;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, 'image/jpeg', quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function uploadWithProgress(file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const fd = new FormData();
        fd.append('image', file);
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                onProgress(percent);
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve(data);
                } catch (e) {
                    reject(e);
                }
            } else {
                reject(new Error('Upload failed'));
            }
        });
        
        xhr.addEventListener('error', () => reject(new Error('Network error')));
        
        xhr.open('POST', `https://api.imgbb.com/1/upload?key=${API_KEY}`);
        xhr.send(fd);
    });
}

uploadBtn.onclick = async () => {
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<div class="spinner"></div>';
    
    const progressContainer = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    progressContainer.style.display = 'block';
    
    const filesToUpload = [...selectedFiles];
    const currentTitle = albumTitleInput.value || 'Без названия';
    let results = [];
    const shouldCompress = compressCheckbox.checked;
    const quality = parseFloat(compressionQuality.value);

    for (let i = 0; i < filesToUpload.length; i++) {
        let file = filesToUpload[i];
        
        if (shouldCompress && file.type.startsWith('image/')) {
            try {
                file = await compressImage(file, quality);
            } catch (e) {
                console.error('Compression error:', e);
            }
        }
        
        try {
            const data = await uploadWithProgress(file, (percent) => {
                const totalProgress = ((i / filesToUpload.length) * 100) + (percent / filesToUpload.length);
                progressFill.style.width = totalProgress + '%';
                progressText.textContent = `${Math.round(totalProgress)}% (${i + 1}/${filesToUpload.length})`;
            });
            
            if (data.success) {
                const id = data.data.url.split('/').slice(-2)[0];
                results.push({ id, thumb: data.data.display_url, url: data.data.url });
            }
        } catch (e) { 
            console.error('Ошибка загрузки:', e); 
        }
    }

    progressFill.style.width = '100%';
    progressText.textContent = '100%';

    const tagsInput = document.getElementById('imageTags');
    const tags = tagsInput.value.split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

    if (results.length > 0) {
        if (isAlbumMode) {
            saveToHistory('album', results.map(r => r.id).join(','), results[0].thumb, currentTitle, tags);
        } else {
            results.forEach(img => saveToHistory('single', img.id, img.thumb, 'Фото', tags));
        }
    }
    
    tagsInput.value = '';
    location.reload();
};

function saveToHistory(type, id, thumb, title, tags = []) {
    let history = JSON.parse(localStorage.getItem('cs_v3_history') || '[]');
    history.unshift({ type, id, thumb, title, tags, date: Date.now() });
    localStorage.setItem('cs_v3_history', JSON.stringify(history.slice(0, 100)));
}

window.deleteFromHistory = (index, event) => {
    event.stopPropagation();
    if (confirm('Удалить это изображение из истории?')) {
        let history = JSON.parse(localStorage.getItem('cs_v3_history') || '[]');
        history.splice(index, 1);
        localStorage.setItem('cs_v3_history', JSON.stringify(history));
        renderHistory();
        showToast('Удалено из истории');
    }
};

window.downloadImage = async (url, filename, event) => {
    if (event) event.stopPropagation();
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'cloudsnap-image.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        showToast('Загрузка началась');
    } catch (e) {
        console.error('Download error:', e);
        window.open(url, '_blank');
    }
};

function openLightbox(images, startIndex = 0) {
    currentLightboxImages = images;
    currentLightboxIndex = startIndex;
    updateLightboxImage();
    document.getElementById('lightbox').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
    document.body.style.overflow = '';
}

function updateLightboxImage() {
    const img = document.getElementById('lightboxImg');
    img.src = currentLightboxImages[currentLightboxIndex];
    document.getElementById('lightboxPrev').style.display = currentLightboxImages.length > 1 ? 'flex' : 'none';
    document.getElementById('lightboxNext').style.display = currentLightboxImages.length > 1 ? 'flex' : 'none';
}

function lightboxPrev() {
    currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxImages.length) % currentLightboxImages.length;
    updateLightboxImage();
}

function lightboxNext() {
    currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxImages.length;
    updateLightboxImage();
}

document.getElementById('lightboxClose').onclick = closeLightbox;
document.getElementById('lightboxPrev').onclick = lightboxPrev;
document.getElementById('lightboxNext').onclick = lightboxNext;

document.getElementById('lightboxDownload').onclick = () => {
    downloadImage(currentLightboxImages[currentLightboxIndex], `cloudsnap-${Date.now()}.jpg`);
};

document.getElementById('lightboxCopy').onclick = () => {
    copyLink(currentLightboxImages[currentLightboxIndex]);
};

document.getElementById('lightbox').onclick = (e) => {
    if (e.target.id === 'lightbox') closeLightbox();
};

window.openImageLightbox = (imageUrl, event) => {
    if (event) event.stopPropagation();
    openLightbox([imageUrl], 0);
};

window.openAlbumLightbox = (ids, startIndex = 0, event) => {
    if (event) event.stopPropagation();
    const images = ids.map(id => `https://i.ibb.co/${id}/image.png`);
    openLightbox(images, startIndex);
};

function filterHistory(query) {
    const history = JSON.parse(localStorage.getItem('cs_v3_history') || '[]');
    if (!query) return history;
    
    const lowQuery = query.toLowerCase();
    return history.filter(item => 
        item.title.toLowerCase().includes(lowQuery) || 
        (item.tags && item.tags.some(tag => tag.toLowerCase().includes(lowQuery)))
    );
}

searchInput.addEventListener('input', (e) => {
    renderHistory(e.target.value);
});

function renderHistory(searchQuery = '') {
    const history = filterHistory(searchQuery);
    const grid = document.getElementById('historyGrid');
    
    if (history.length === 0) {
        grid.innerHTML = searchQuery 
            ? '<div class="empty-state" style="grid-column:1/-1;">Ничего не найдено</div>'
            : '<div class="empty-state" style="grid-column:1/-1;">Здесь будут ваши загрузки</div>';
        return;
    }

    const fullHistory = JSON.parse(localStorage.getItem('cs_v3_history') || '[]');
    
    grid.innerHTML = history.map((item) => {
        const realIndex = fullHistory.findIndex(h => h.date === item.date && h.id === item.id);
        const url = item.type === 'single' ? `?img=${item.id}` : `?album=${item.id}&t=${encodeURIComponent(item.title)}`;
        const firstId = item.id.split(',')[0];
        const imageUrl = `https://i.ibb.co/${firstId}/image.png`;
        const tagsHTML = (item.tags && item.tags.length > 0) 
            ? `<div class="history-tags">
                ${item.tags.map(tag => `
                    <span class="tag-badge" onclick="event.stopPropagation(); filterByTag('${tag}')">
                        #${tag}
                    </span>
                `).join('')}
               </div>` 
            : '';
        
        return `
            <div class="history-item shimmer-container" onclick="location.href='${url}'">
                ${item.type === 'album' ? `<div class="album-badge">АЛЬБОМ</div>` : ''}
                <img src="${item.thumb}" class="history-thumb fade-in-img" onload="revealImage(this)">
                <div class="history-overlay">
                    <div class="history-title">${item.title}</div>
                    
                    ${tagsHTML}

                    <div class="history-actions">
                        <button class="btn-action-mini" title="Просмотр" onclick="event.stopPropagation(); openImageLightbox('${imageUrl}', event)">
                            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                            </svg>
                        </button>
                        
                        <button class="btn-action-mini" title="Скачать" onclick="downloadImage('${imageUrl}', 'cloudsnap-${firstId}.jpg', event)">
                            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                            </svg>
                        </button>

                        <button class="btn-action-mini" title="Копировать ссылку" onclick="event.stopPropagation(); copyLink('${window.location.origin}${window.location.pathname}${url}')">
                            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                            </svg>
                        </button>
                        
                        <button class="btn-action-mini delete" title="Удалить из истории" onclick="deleteFromHistory(${realIndex}, event)">
                            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.filterByTag = (tagName) => {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = tagName;
    renderHistory(tagName);
};

function showToast(message) {
    const t = document.getElementById('toast');
    t.textContent = message;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

window.copyLink = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Ссылка скопирована');
};

document.getElementById('exportBtn').onclick = () => {
    const history = localStorage.getItem('cs_v3_history') || '[]';
    const blob = new Blob([history], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudsnap-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('История экспортирована');
};

document.getElementById('importBtn').onclick = () => {
    document.getElementById('importFileInput').click();
};

document.getElementById('importFileInput').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            if (Array.isArray(imported)) {
                const existing = JSON.parse(localStorage.getItem('cs_v3_history') || '[]');
                const merged = [...imported, ...existing];
                const unique = merged.filter((item, index, self) => 
                    index === self.findIndex(t => t.id === item.id && t.date === item.date)
                );
                unique.sort((a, b) => b.date - a.date);
                localStorage.setItem('cs_v3_history', JSON.stringify(unique.slice(0, 100)));
                renderHistory();
                showToast(`Импортировано ${imported.length} записей`);
            } else {
                showToast('Неверный формат файла');
            }
        } catch (err) {
            showToast('Ошибка чтения файла');
        }
    };
    reader.readAsText(file);
    e.target.value = ''; 
};

window.toggleShortcutsHelp = () => {
    document.getElementById('shortcutsHelp').classList.toggle('active');
};

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'v') {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            navigator.clipboard.read().then(async (items) => {
                for (const item of items) {
                    for (const type of item.types) {
                        if (type.startsWith('image/')) {
                            const blob = await item.getType(type);
                            const file = new File([blob], `pasted-image-${Date.now()}.png`, { type });
                            handleFiles([file]);
                            showToast('Изображение вставлено');
                            return;
                        }
                    }
                }
            }).catch(() => {
            });
        }
    }
    
    if (e.key === 'Escape') {
        if (document.getElementById('lightbox').classList.contains('active')) {
            closeLightbox();
        }
        if (document.getElementById('shortcutsHelp').classList.contains('active')) {
            toggleShortcutsHelp();
        }
    }
    
    if (document.getElementById('lightbox').classList.contains('active')) {
        if (e.key === 'ArrowLeft') lightboxPrev();
        if (e.key === 'ArrowRight') lightboxNext();
    }
    
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            toggleShortcutsHelp();
        }
    }
});

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, false);
});

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('drag-over');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('drag-over');
    }, false);
});

dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = Array.from(dt.files);
    handleFiles(files);
});

function handleFiles(files) {
    selectedFiles = files.filter(f => f.type.startsWith('image/'));
    
    const queueContainer = document.getElementById('uploadQueue');
    queueContainer.innerHTML = ''; 

    selectedFiles.forEach(file => {
        const item = document.createElement('div');
        item.className = 'uploading-item';
        const previewUrl = URL.createObjectURL(file);
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                <div class="preview-mini-box">
                    <img src="${previewUrl}" alt="preview">
                </div>
                <div style="display: flex; flex-direction: column; overflow: hidden; flex-grow: 1;">
                    <span class="file-name-text">${file.name}</span>
                    <span style="color:var(--text-dim); font-size: 12px;">${(file.size/1024/1024).toFixed(1)}MB</span>
                </div>
            </div>
        `;
        queueContainer.appendChild(item);
    });
    
    uploadBtn.disabled = selectedFiles.length === 0;
    uploadBtn.innerText = `Загрузить (${selectedFiles.length})`;
}

fileInput.onchange = (e) => {
    handleFiles(Array.from(e.target.files));
};

const themeToggle = document.getElementById('themeToggle');
const sunIcon = themeToggle.querySelector('.sun-icon');
const moonIcon = themeToggle.querySelector('.moon-icon');

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateIcons(newTheme);
}

function updateIcons(theme) {
    if (theme === 'light') {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
    }
}

const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
updateIcons(savedTheme);

themeToggle.addEventListener('click', toggleTheme);

const params = new URLSearchParams(window.location.search);
if (params.has('img') || params.has('album')) {
    document.getElementById('mainLayout').style.display = 'none';
    const view = document.createElement('div');
    view.className = 'view-container';
    
    if (params.has('img')) {
        const id = params.get('img');
        const imageUrl = `https://i.ibb.co/${id}/image.png`;
        view.innerHTML = `
            <div class="shimmer-container" style="background:var(--card-bg); padding:20px; border-radius:32px; border:1px solid var(--glass-border); box-shadow:var(--card-shadow); min-height:300px;">
                <img src="${imageUrl}" class="fade-in-img" style="width:100%; border-radius:20px; cursor:pointer;" onload="revealImage(this)" onclick="openImageLightbox('${imageUrl}')">
                <div style="margin-top:30px; display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
                    <button class="btn btn-primary" style="width:auto" onclick="downloadImage('${imageUrl}', 'cloudsnap-${id}.jpg')">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:8px;">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                        </svg>
                        Скачать
                    </button>
                    <button class="btn" style="width:auto; background:rgba(255,255,255,0.1); color:white;" onclick="copyLink('${imageUrl}')">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:8px;">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                        </svg>
                        Копировать ссылку
                    </button>
                    <a href="${window.location.pathname}" class="btn" style="width:auto; background:rgba(255,255,255,0.1); color:white;">Вернуться в CloudSnap</a>
                </div>
            </div>
        `;
    } else {
        const ids = params.get('album').split(',');
        const title = params.get('t') || 'Альбом';
        view.innerHTML = `
            <div class="album-header">
                <h1>${title}</h1>
                <p style="color:var(--text-dim); font-weight:600;">Коллекция из ${ids.length} фото</p>
            </div>
            <div class="album-grid-view">
                ${ids.map((id, index) => `
                    <div class="album-img-card shimmer-container">
                        <img src="https://i.ibb.co/${id}/image.png" class="fade-in-img" onclick="openAlbumLightbox(${JSON.stringify(ids)}, ${index})" onload="revealImage(this)">
                        <div class="album-img-actions">
                            <button class="btn-action-mini" onclick="downloadImage('https://i.ibb.co/${id}/image.png', 'cloudsnap-${id}.jpg', event)">
                                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                                </svg>
                                Скачать
                            </button>
                            <button class="btn-action-mini" onclick="event.stopPropagation(); copyLink('https://i.ibb.co/${id}/image.png')">
                                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                                </svg>
                                Ссылка
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:60px;"><a href="${window.location.pathname}" class="btn btn-primary" style="width:auto">Создать свой альбом</a></div>
        `;
    }
    document.body.appendChild(view);
} else {
    renderHistory();
}
