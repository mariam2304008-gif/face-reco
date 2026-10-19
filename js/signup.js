

    document.querySelectorAll('.toggle-pass').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var input = document.getElementById(btn.dataset.target);
                var show = input.type === 'password';

                input.type = show ? 'text' : 'password';
                btn.classList.toggle('is-visible', show);
                btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
            });
        });

const form = document.querySelector('.signup-form');


const rules = {
    name: function (v) {
        if (v.trim().length < 3) return 'Please enter your full name.';
        if (!/^[A-Za-z\u0600-\u06FF\s'-]+$/.test(v)) return 'Name can only contain letters.';
        return '';
    },
    'student-id': function (v) {
        if (!/^\d{4}\/\d{5}$/.test(v.trim())) return 'Use the format 2024/01693.';
        return '';
    },
    email: function (v) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Enter a valid email address.';
        return '';
    },
    department: function (v) {
        if (!v) return 'Please select your faculty.';5
        return '';
    },
    password: function (v) {
        if (v.length < 8) return 'Password must be at least 8 characters.';
        if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Use at least one letter and one number.';
        return '';
    },
    confirm: function (v) {
        if (v !== document.getElementById('password').value) return 'Passwords do not match.';
        return '';
    }
};

function showError(input, message) {
    var errId = input.id + '-error';
    var err = document.getElementById(errId);

    if (!err) {
        err = document.createElement('p');
        err.className = 'error';
        err.id = errId;
        var box = input.closest('.field');
        if (box) {
            box.appendChild(err);
        } else {
            input.closest('.consent').after(err); 
        }
    }
    err.textContent = message;
    input.classList.toggle('invalid', message !== '');
}

function validateField(input) {
    var message = '';
    if (input.id === 'consent') {
        message = input.checked ? '' : 'You must agree to continue.';
    } else if (rules[input.id]) {
        message = rules[input.id](input.value);
    }
    showError(input, message);
    return message === '';
}

var allInputs = form.querySelectorAll('input, select');


allInputs.forEach(function (input) {
    input.addEventListener('blur', function () { validateField(input); });
    input.addEventListener('input', function () {
        if (input.classList.contains('invalid')) validateField(input);
        if (input.id === 'password' && document.getElementById('confirm').value) {
            validateField(document.getElementById('confirm'));
        }
    });
});


form.addEventListener('submit', function (e) {
    var firstBad = null;

    allInputs.forEach(function (input) {
        if (!validateField(input) && !firstBad) firstBad = input;
    });

    if (firstBad) {
        e.preventDefault();
        firstBad.focus();
    }
});