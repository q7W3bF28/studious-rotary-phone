document.addEventListener('DOMContentLoaded', function() {
    if (typeof Ably === 'undefined') {
        console.error('Ably library not loaded');
        return;
    }

    const ably = new Ably.Realtime('nc5NGw.wSmsXg:SMs5pD5aJ4hGMvNZnd7pJp2lYS2X1iCmWm_yeLx_pkk');
    
    const comicTitle = document.getElementById('comic-title');
    const comicTitleInfo = document.getElementById('comic-title-info');
    const comicDesc = document.getElementById('comic-desc');
    const uploadTime = document.getElementById('upload-time');
    const fileType = document.getElementById('file-type');
    const fileSize = document.getElementById('file-size');
    const comicContent = document.getElementById('comic-content');
    const comicLoading = document.getElementById('comic-loading');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageCounter = document.getElementById('page-counter');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomResetBtn = document.getElementById('zoom-reset');

    const urlParams = new URLSearchParams(window.location.search);
    const shelfId = urlParams.get('shelf');
    const password = urlParams.get('password');
    
    let currentComic = null;
    let currentPage = 1;
    let totalPages = 1;
    let zoomLevel = 1;
    
    if (!shelfId || !password) {
        window.location.href = 'view.html';
        return;
    }
    
    async function loadComic() {
        comicLoading.classList.remove('hidden');
        try {
            const shelfChannel = ably.channels.get(`comic-share:shelf-${shelfId}`);
            
            const handleMessage = (message) => {
                if (message.data && message.data.password === password) {
                    currentComic = message.data.data;
                    displayComic();
                    shelfChannel.unsubscribe(handleMessage); 
                }
            };

            shelfChannel.subscribe('comic-upload', handleMessage);

            const history = await shelfChannel.history({ limit: 100 });
            for (let i = 0; i < history.items.length; i++) {
                const message = history.items[i];
                if (message.data && message.data.password === password) {
                    currentComic = message.data.data;
                    displayComic();
                    shelfChannel.unsubscribe(handleMessage);
                    return; 
                }
            }
            
            // If after checking history no comic is found, display a message.
            // A timeout gives live messages a chance to arrive.
            setTimeout(() => {
                if (!currentComic) {
                    comicLoading.innerHTML = '<p>书柜中没有找到与密码匹配的漫画。</p>';
                }
            }, 5000);

        } catch (error) {
            console.error('加载漫画失败:', error);
            comicLoading.innerHTML = '<p>加载漫画失败，请检查网络连接。</p>';
        }
    }
    
    function displayComic() {
        if (!currentComic) return;

        comicTitle.textContent = currentComic.title;
        comicTitleInfo.textContent = currentComic.title;
        comicDesc.textContent = currentComic.description || '无描述';
        uploadTime.textContent = new Date(currentComic.uploadTime).toLocaleString();
        fileType.textContent = currentComic.fileType.toUpperCase();
        fileSize.textContent = currentComic.fileSize || '未知';
        
        comicLoading.classList.add('hidden');
        comicContent.classList.remove('hidden');
        
        if (currentComic.fileType === 'pdf') {
            displayPdf();
        } else if (currentComic.fileType === 'epub') {
            displayEpub();
        } else if (currentComic.fileType === 'zip') {
            displayZip();
        } else {
            comicContent.innerHTML = '<p>不支持的文件类型。</p>';
        }
    }
    
    function displayPdf() {
        comicContent.innerHTML = `<iframe src="https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(currentComic.fileUrl)}" width="100%" height="100%" style="border: none;"></iframe>`;
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        pageCounter.textContent = 'PDF阅读器';
        zoomInBtn.disabled = true;
        zoomOutBtn.disabled = true;
        zoomResetBtn.disabled = true;
    }
    
    function displayEpub() {
        comicContent.innerHTML = `<div id="epub-container" style="height: 100%; width: 100%;"></div>`;
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/epubjs/dist/epub.min.js';
        script.onload = function() {
            const book = ePub(currentComic.fileUrl);
            const rendition = book.renderTo("epub-container", { width: "100%", height: "100%", spread: "auto" });
            rendition.display();

            book.ready.then(() => {
                // This is a bit tricky with epub.js pagination. We will listen to location changes.
                rendition.on("displayed", function(location){
                    var cfi = location.start.cfi;
                    var progress = book.locations.percentageFromCfi(cfi);
                    totalPages = book.locations.length();
                    currentPage = Math.round(progress * totalPages) || 1;
                    updatePageCounter();
                });
            });

            prevPageBtn.onclick = () => rendition.prev();
            nextPageBtn.onclick = () => rendition.next();
        };
        document.head.appendChild(script);
    }
    
    function displayZip() {
        comicContent.innerHTML = `<div class="loading-indicator"><div class="spinner"></div><p>正在解压文件...</p></div>`;
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js';
        script.onload = function() {
            fetch(currentComic.fileUrl)
                .then(res => res.blob())
                .then(blob => JSZip.loadAsync(blob))
                .then(zip => {
                    const imageFiles = [];
                    zip.forEach((relativePath, file) => {
                        if (!file.dir && file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                            imageFiles.push(file);
                        }
                    });
                    imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
                    return Promise.all(imageFiles.map(file => file.async('blob')));
                })
                .then(imageBlobs => {
                    const images = imageBlobs.map(blob => URL.createObjectURL(blob));
                    totalPages = images.length;
                    currentPage = 1;
                    
                    const showImage = (page) => {
                        comicContent.innerHTML = `<img src="${images[page - 1]}" alt="Page ${page}" style="max-width: 100%; max-height: 100%; object-fit: contain; transform: scale(${zoomLevel});">`;
                        updatePageCounter();
                    };

                    showImage(currentPage);

                    const navigate = (direction) => {
                        const newPage = currentPage + direction;
                        if (newPage >= 1 && newPage <= totalPages) {
                            currentPage = newPage;
                            showImage(currentPage);
                        }
                    };
                    
                    prevPageBtn.onclick = () => navigate(-1);
                    nextPageBtn.onclick = () => navigate(1);

                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'ArrowLeft') navigate(-1);
                        if (e.key === 'ArrowRight') navigate(1);
                    });
                })
                .catch(error => {
                    console.error('解压ZIP失败:', error);
                    comicContent.innerHTML = `<p>解压文件失败: ${error.message}</p>`;
                });
        };
        document.head.appendChild(script);
    }

    function updatePageCounter() {
        pageCounter.textContent = `${currentPage} / ${totalPages}`;
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }

    function applyZoom() {
        const img = comicContent.querySelector('img');
        if (img) {
            img.style.transform = `scale(${zoomLevel})`;
        }
    }

    zoomInBtn.addEventListener('click', () => { zoomLevel = Math.min(zoomLevel + 0.2, 3); applyZoom(); });
    zoomOutBtn.addEventListener('click', () => { zoomLevel = Math.max(zoomLevel - 0.2, 0.5); applyZoom(); });
    zoomResetBtn.addEventListener('click', () => { zoomLevel = 1; applyZoom(); });

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            fullscreenBtn.textContent = '❐';
            fullscreenBtn.title = '退出全屏';
        } else {
            fullscreenBtn.textContent = '⛶';
            fullscreenBtn.title = '全屏';
        }
    });

    loadComic();
});
