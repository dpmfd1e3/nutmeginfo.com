const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require("es6-promisify");
exports.loginForm = (req, res) => {
    res.render('login', {title: 'Login'});
};

exports.registerForm = (req, res) => {
    res.render('register', {title: 'Register'});
};

exports.validateRegister = (req, res, next) => {
    req.sanitizeBody('name');
    req.checkBody('name', 'You must supply an Email').notEmpty();
    req.checkBody('email', 'That Email is not Valid!').isEmail();
    req.sanitizeBody('email').normalizeEmail({
        remove_dots: false,
        remove_extension: false,
        gmail_remove_subaddress: false
    });  
    req.checkBody('password', 'Password Cannot be Blank!').notEmpty();
    req.checkBody('password-confirm', 'Comfirmed Password Cannot be Blank!').notEmpty();
    req.checkBody('password-confirm', 'Oops!  Passwords do not match').equals(req.body.password);

    const errors = req.validationErrors();
    if (errors) {
        req.flash('error', errors.map(err => err.msg));
        res.render('register', {title: 'Register', body: req.body, flashes: req.flash() });
        return; // stop function from running due to errors
    }
    next(); // No errors noted
};

exports.register = async (req, res, next) => {
    const user = new User ({email: req.body.email, name: req.body.name });
    const register = promisify(User.register, User);
    await register(user, req.body.password);
    next(); // pass to auth controller.login
}

exports.account = (req, res) =>{
    res.render('account', {title:"Edit your account"});
}

exports.updateAccount = async (req, res) => {
    const updates = {
        name: req.body.name,
        email: req.body.email
    };

    const user = await User.findOneAndUpdate(
        { _id: req.user._id },
        { $set: updates },
        { new: true, runValidators: true, context: 'querry' }
    );
    req.flash('success', 'Updated the Profile');
    res.redirect('back');
}