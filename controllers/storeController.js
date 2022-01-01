const mongose = require('mongoose');
const { AsyncDependenciesBlock } = require('webpack');
const Store = mongose.model('Store');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

const multerOptions = {
    storage: multer.memoryStorage(),
    fileFilter(req, file, next) {
        const isPhoto = file.mimetype.startsWith('image/');
        if(isPhoto) {
            next(null, true);
        } else {
            next({ message: 'That File Type isn\'t allowed!'}, false);
        }
    }
};


exports.homePage = (req, res) => {
    res.render('index');
};


exports.addStore = (req, res) => {
    res.render('editStore', { title: 'Add Store' });
};

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
    // check to see if there is no new photo to resize
    if (!req.file) {
        next(); // skip to next middleware
        return;
    }
    const extension = req.file.mimetype.split('/')[1];
    req.body.photo = `${uuid.v4()}.${extension}`;
    //resize
    const photo = await jimp.read(req.file.buffer);
    await photo.resize(800, jimp.AUTO);
    await photo.write(`./public/uploads/${req.body.photo}`);
    // keep going after write
    next();
};

exports.createStore = async (req, res) => {
    req.body.author = req.user._id;
    const store = await (new Store(req.body)).save();
    req.flash('success', `Successfully Created ${store.name}. Care to leave a review`)    
    res.redirect(`../store/${store.name}`);
};

exports.getStores = async (req, res) => {
    const stores = await Store.find();
    res.render('stores', { title: 'Stores', stores });
};

const confirmOwner = (store, user) => {
    if (!store.author.equals(user._id)) {
        throw Error('You must own a store to edit it');
    }
};

exports.editStore = async (req, res) => {
 //1. find the store given the ID
    const store = await Store.findOne({_id: req.params.id})
 //2. Confirm that they are the owner of the store
    confirmOwner(store, req.user);
 //3. Render out the edit fore so the user can update their store
    res.render('editStore', { title: `Edit ${store.name}`, store})
}

exports.updateStore = async (req, res) => {
    // set the location data to be a point
    req.body.location.type = 'Point';
    // find and upate a store
    const store = await Store.findOneAndUpdate({ _id: req.params.id}, req.body, {
        new:true, 
        runValidators:true
    }).exec();
    req.flash('sucess', `Successfully updated <strong>${store.name}</strong> <a href="/stores/${store.slug}">View Store</a>`);
    // redirect them to sore and show success
    res.redirect(`/stores/${store._id}/edit`);
}

exports.getStoreBySlug = async (req, res, next) => {
    const store = await Store.findOne({ slug: req.params.slug }).populate('author');
    if(!store) return next();
    res.render('store', {store, title: store.name});
};

exports.getStoreByTag = async (req, res) => {
    const tag = req.params.tag;
    const tagQuery = tag || { $exists: true} ;

    const tagsPromise = Store.getTagsList();
    const storesPromise = Store.find({ tags: tagQuery});
    const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);;
    
     res.render('tag', { tags, title: 'Tags', tag, stores });
};

exports.searchStores = async (req, res) => {
    const stores = await Store
    //find stores that match
    .find({
        $text: {
            $search: req.query.q
        }
    }, {
            score: { $meta: 'textScore' }
    })
    // sort stores by score 
    .sort({
        score: { $meta: 'textScore' }
    })
    // Limit results
    .limit(5);
    res.json(stores);
};

exports.mapStores = async (req, res) => {
    const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
    const q = {
        location:{
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates
                },
                $maxDistance: 500000 //10KM
            }
        }

    };

    const stores = await Store.find(q).select('slug name description location photo').limit(10);
    res.json(stores);
};

exports.mapPage = (req, res) => {
    res.render('map', {title:'Map'});
}

exports.heartStore = async (req, res) => {
    const hearts = req.user.hearts.map(obj => obj.toString());
    const operators = hearts.includes(req.params.id) ? '$pull' : '$addToSet';
    res.json(hearts);
}