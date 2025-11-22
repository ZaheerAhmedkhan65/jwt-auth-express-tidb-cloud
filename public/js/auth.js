// public/js/auth.js
class AuthUI {
    constructor(basePath = '/auth') {
        this.basePath = basePath;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
    }

    // Custom alert system
    showAlert(message, type = 'info') {
        // Remove existing alerts
        this.removeAlerts();

        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = `
            <div class="alert-content">
                <span class="alert-message">${message}</span>
                <button class="alert-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // Add styles if not already added
        this.addAlertStyles();

        document.body.appendChild(alert);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.parentElement) {
                alert.remove();
            }
        }, 5000);
    }

    addAlertStyles() {
        if (document.getElementById('alert-styles')) return;

        const styles = `
            <style id="alert-styles">
                .alert {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    min-width: 300px;
                    max-width: 500px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    border-left: 4px solid #007bff;
                    animation: slideInRight 0.3s ease-out;
                }

                .alert-success { border-left-color: #28a745; }
                .alert-error { border-left-color: #dc3545; }
                .alert-warning { border-left-color: #ffc107; }
                .alert-info { border-left-color: #17a2b8; }

                .alert-content {
                    padding: 12px 16px;
                    display: flex;
                    justify-content: between;
                    align-items: center;
                }

                .alert-message {
                    flex: 1;
                    margin-right: 10px;
                }

                .alert-close {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    color: #666;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .alert-close:hover {
                    color: #000;
                }

                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    removeAlerts() {
        const existingAlerts = document.querySelectorAll('.alert');
        existingAlerts.forEach(alert => alert.remove());
    }


    // Form handling
    async handleFormSubmit(event, formType, formElement) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
        this.removeAlerts();

        try {
            const response = await fetch(`${formElement.action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                credentials: 'include' // Important for cookies
            });

            const result = await response.json();
            
            if (result.success) {
                this.showAlert(result.message, 'success');
                console.log(this.basePath);
                // Handle redirects
                setTimeout(() => {
                    if (formType === 'signin') {
                        window.location.href = '/';
                    } else if (formType === 'signup') {
                        window.location.href = `${this.basePath}/signin`;
                    } else if (formType === 'signout') {
                        window.location.href = `${this.basePath}/signin`;
                    } else if (formType === 'forgot-password') {
                        window.location.href = `${this.basePath}/signin`;
                    } else if (formType === 'reset-password') {
                        window.location.href = `${this.basePath}/signin`;
                    }
                }, 1500);
            } else {
                console.error(this.basePath);
                this.showAlert(result.message || 'An error occurred', 'error');
            }
        } catch (error) {
            this.showAlert('Network error. Please try again.', 'error');
            console.error('Form submission error:', error);
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    // Check authentication status
    async checkAuthStatus() {
        try {
            const response = await fetch(`${this.basePath}/me`, {
                credentials: 'include'
            });

            if (response.ok) {
                const result = await response.json();
                this.updateUIForAuthenticated(result.data.user);
            } else {
                this.updateUIForUnauthenticated();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.updateUIForUnauthenticated();
        }
    }

    // Update UI based on auth status
    updateUIForAuthenticated(user) {
        // Update navigation or other UI elements
        const authElements = document.querySelectorAll('[data-auth]');
        authElements.forEach(element => {
            if (element.dataset.auth === 'authenticated') {
                element.style.display = 'block';
            } else if (element.dataset.auth === 'unauthenticated') {
                element.style.display = 'none';
            }
        });

        // Update user info if elements exist
        const userEmailElement = document.querySelector('[data-user-email]');
        if (userEmailElement) {
            userEmailElement.textContent = user.email;
        }

        const userNameElement = document.querySelector('[data-user-name]');
        if (userNameElement) {
            userNameElement.textContent = user.name;
        }
    }

    updateUIForUnauthenticated() {
        const authElements = document.querySelectorAll('[data-auth]');
        authElements.forEach(element => {
            if (element.dataset.auth === 'authenticated') {
                element.style.display = 'none';
            } else if (element.dataset.auth === 'unauthenticated') {
                element.style.display = 'block';
            }
        });
    }

    // Setup event listeners
    setupEventListeners() {
        // Sign up form
        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => this.handleFormSubmit(e, 'signup', signupForm));
        }

        // Sign in form
        const signinForm = document.getElementById('signin-form');
        if (signinForm) {
            signinForm.addEventListener('submit', (e) => this.handleFormSubmit(e, 'signin', signinForm));
        }

        // Forgot password form
        const forgotPasswordForm = document.getElementById('forgot-password-form');
        if (forgotPasswordForm) {
            forgotPasswordForm.addEventListener('submit', (e) => this.handleFormSubmit(e, 'forgot-password', forgotPasswordForm));
        }

        // Reset password form
        const resetPasswordForm = document.getElementById('reset-password-form');
        if (resetPasswordForm) {
            resetPasswordForm.addEventListener('submit', (e) => this.handleFormSubmit(e, 'reset-password', forgotPasswordForm));
        }

        // Sign out buttons
        const signoutButtons = document.querySelectorAll('[data-signout]');
        signoutButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleSignOut();
            });
        });
    }

    // Handle sign out
    async handleSignOut() {
        try {
            const response = await fetch(`${this.basePath}/signout`, {
                method: 'POST',
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                this.showAlert('Signed out successfully', 'success');
                setTimeout(() => {
                    window.location.href = `${this.basePath}/signin`;
                }, 1500);
            } else {
                this.showAlert(result.message || 'Sign out failed', 'error');
            }
        } catch (error) {
            this.showAlert('Network error during sign out', 'error');
            console.error('Sign out error:', error);
        }
    }
}