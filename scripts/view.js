document.addEventListener('DOMContentLoaded', function() {
    if (typeof Ably === 'undefined') {
        console.error('Ably library not loaded');
        return;
    }

    const ably = new Ably.Realtime('nc5NGw.wSmsXg:SMs5pD5aJ4hGMvNZnd7pJp2lYS2X1iCmWm_yeLx_pkk');
    
    const bookshelfGrid = document.getElementById('bookshelf-grid');
    const passwordModal = document.getElementById('password-modal');
    const modalShelfName = document.getElementById('modal-shelf-name');
    const passwordForm = document.getElementById('password-form');
    const cancelPasswordBtn = document.getElementById('cancel-password');
    const passwordError = document.getElementById('password-error');
    const passwordInput = document.getElementById('shelf-password');
    
    let selectedShelf = null;
    let currentPassword = '123456';
    let shelfChannel;

    function initBookshelves() {
        if (!bookshelfGrid) return;
        bookshelfGrid.innerHTML = '';
        for (let i = 1; i <= 10; i++) {
            const bookshelfItem = document.createElement('div');
            bookshelfItem.className = 'bookshelf-item';
            bookshelfItem.dataset.shelfId = i;
            
            bookshelfItem.innerHTML = `
                <div class="icon">📚</div>
                <h3>书柜 ${i}</h3>
                <p>点击输入密码查看</p>
            `;
            bookshelfItem.addEventListener('click', () => openPasswordModal(i));
            bookshelfGrid.appendChild(bookshelfItem);
        }
    }
    
    function openPasswordModal(shelfId) {
        selectedShelf = shelfId;
        currentPassword = '123456'; // Reset to initial password
        modalShelfName.textContent = `书柜 ${shelfId}`;
        passwordModal.classList.add('show');
        passwordInput.value = '';
        passwordError.style.display = 'none';

        if (shelfChannel) {
            shelfChannel.unsubscribe();
        }
        shelfChannel = ably.channels.get(`comic-share:shelf-${shelfId}`);
        shelfChannel.subscribe('comic-upload', (message) => {
            if (message.data && message.data.password) {
                currentPassword = message.data.password;
            }
        });
        
        setTimeout(() => passwordInput.focus(), 100);
    }
    
    function closePasswordModal() {
        passwordModal.classList.remove('show');
        if (shelfChannel) {
            shelfChannel.unsubscribe();
            shelfChannel = null;
        }
    }
    
    cancelPasswordBtn.addEventListener('click', closePasswordModal);
    
    passwordModal.addEventListener('click', function(e) {
        if (e.target === passwordModal) {
            closePasswordModal();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && passwordModal.classList.contains('show')) {
            closePasswordModal();
        }
    });

    passwordForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const enteredPassword = passwordInput.value;
        
        if (enteredPassword === currentPassword) {
            window.location.href = `viewer.html?shelf=${selectedShelf}&password=${enteredPassword}`;
        } else {
            passwordError.style.display = 'block';
            passwordInput.value = '';
            passwordInput.focus();
            
            passwordInput.classList.add('shake');
            setTimeout(() => {
                passwordInput.classList.remove('shake');
            }, 500);
        }
    });

    initBookshelves();
});
