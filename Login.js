const studentBtn = document.getElementById('studentBtn');
const facultyBtn = document.getElementById('facultyBtn');
const emailLabel = document.getElementById('emailLabel');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePassword');
const loginForm = document.getElementById('loginForm');

const usernameWrapper = document.getElementById('usernameWrapper');
const passwordWrapper = document.getElementById('passwordWrapper');
const usernameError = document.getElementById('usernameError');
const passwordError = document.getElementById('passwordError');


function showError(inputWrapper, errorElement, message) {
    inputWrapper.classList.add('input-error');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}


function clearError(inputWrapper, errorElement) {
    inputWrapper.classList.remove('input-error');
    errorElement.textContent = '';
    errorElement.style.display = 'none';
}


usernameInput.addEventListener('input', () => clearError(usernameWrapper, usernameError));
passwordInput.addEventListener('input', () => clearError(passwordWrapper, passwordError));


studentBtn.addEventListener('click', () => {
    studentBtn.classList.add('active');
    facultyBtn.classList.remove('active');

    emailLabel.textContent = 'Student Email';
    usernameInput.placeholder = 'student@university.edu';
    clearError(usernameWrapper, usernameError);
});


facultyBtn.addEventListener('click', () => {
    facultyBtn.classList.add('active');
    studentBtn.classList.remove('active');

    emailLabel.textContent = 'Admin Email';
    usernameInput.placeholder = 'admin@university.edu';
    clearError(usernameWrapper, usernameError);
});


togglePasswordBtn.addEventListener('click', () => {
    const isHidden = passwordInput.getAttribute('type') === 'password';

    if (isHidden) {
        passwordInput.setAttribute('type', 'text');
        togglePasswordBtn.classList.add('show-password');
    } else {
        passwordInput.setAttribute('type', 'password');
        togglePasswordBtn.classList.remove('show-password');
    }
});


function validatePassword(v) {
    if (v.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Use at least one letter and one number.';
    return '';
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    let isValid = true;
    const emailValue = usernameInput.value.trim();
    const passwordValue = passwordInput.value;
    const isAdmin = facultyBtn.classList.contains('active');


    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (!emailValue) {
        showError(usernameWrapper, usernameError, 'Please enter your email address.');
        isValid = false;
    } else if (!emailRegex.test(emailValue)) {
        showError(usernameWrapper, usernameError, 'Please enter a valid email format.');
        isValid = false;
    } else {
        clearError(usernameWrapper, usernameError);
    }


    const passwordErrorMessage = validatePassword(passwordValue);
    if (passwordErrorMessage) {
        showError(passwordWrapper, passwordError, passwordErrorMessage);
        isValid = false;
    } else {
        clearError(passwordWrapper, passwordError);
    }


    if (isValid) {
        if (isAdmin) {
            window.location.href = "AdminDash.html";
        } else {
            window.location.href = "student_portal.html";
        }
    }
});