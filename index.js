const express = require('express');
const cors = require('cors');
const app = express();
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs')

const salt = bcrypt.genSaltSync(10);
const secret = 'jijsidfjisdfjisfj';

app.use(cors({ credentials: true}));
app.use(express.json());
app.use(cookieParser());

app.use('/uploads', express.static(__dirname + '/uploads'));

const connectUrl = 'mongodb+srv://blog:zTfFFYCaI4xdCKcn@cluster0.3sh9cxr.mongodb.net/?retryWrites=true&w=majority';
mongoose.connect(connectUrl);

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const UserDoc = await User.create({
            username,
            password: bcrypt.hashSync(password, salt)
        });
        jwt.sign({ username, id: UserDoc._id }, secret, {}, (err, token) => {
            if (err) throw err;
            res.cookie('token', token).json({
                id: UserDoc._id,
                username
            });
        });
    } catch (e) {
        res.status(400).json(e);
    }

});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const UserDoc = await User.findOne({ username });
    if (!UserDoc) {
        res.status(400).json('No such username found');
    } else {
        const passOk = bcrypt.compareSync(password, UserDoc.password);
        if (passOk) {
            // logged in
            jwt.sign({ username, id: UserDoc._id }, secret, {}, (err, token) => {
                if (err) throw err;
                res.cookie('token', token).json({
                    id: UserDoc._id,
                    username
                });
            });

        } else {
            res.status(400).json('Wrong credentials');
        }
    }

})

app.post('/new-post', upload.single('image'), async (req, res) => {
    let newPath = '';
    if (req.file) {
        const { originalname, path } = req?.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
    }

    const { token } = req.cookies;
    console.log(req.cookies);
    jwt.verify(token, secret, {}, async (err, info) => {
        console.log('djsif');
        if (err) throw err;
        const { title, summary, content } = req.body;
        const PostDoc = await Post.create({
            title,
            summary,
            content,
            image: newPath,
            author: info.id
        });
        res.json(PostDoc);
    })
})

app.get('/post', async (req, res) => {
    res.json(await Post.find()
        .populate('author', ['username'])
        .sort({ createdAt: -1 })
        .limit(10));
});

app.put('/post/:id', upload.single('image'), async (req, res) => {
    const { id } = req.params;
    let newPath = '';
    if (req.file) {
        const { originalname, path } = req.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
    }

    const { token } = req.cookies;

    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;

        const { title, summary, content } = req.body;
        let PostDoc = await Post.findById(id);

        const isAuthor = JSON.stringify(PostDoc.author) === JSON.stringify(info.id);
        if (isAuthor) {
            PostDoc.title = title
            PostDoc.summary = summary
            PostDoc.content = content
            PostDoc.image = newPath ? newPath : PostDoc.image
            PostDoc.save()
            res.json(PostDoc);
        } else {
            res.status(400).json('Invalid user');
        }
    })
})

app.get('/profile', async (req, res) => {
    const { token } = await req.cookies;
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) throw err;
        res.json(info);
    })
})

app.get('/delete/:id', async (req, res) => {
    const { id } = req.params;
    const { token } = req.cookies;

    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err
        const PostDoc = await Post.findById(id);
        const isAuthor = JSON.stringify(PostDoc).author === JSON.stringify(info).id
        if (isAuthor) {
            const response = await Post.deleteOne(Post.findById(id));
            if (response) {
                res.json('ok');
            } else {
                res.status(400).json('Some error occured')
            }
        } else {
            res.status(400).json('invalid user');
        }
    })

})

app.get('/post/:id', async (req, res) => {
    const { id } = req.params;
    const postDoc = await Post.findById(id).populate('author', ['username']);
    res.json(postDoc);
});

app.post('/logout', (req, res) => {
    res.cookie('token', '').json('ok');
})

// app.get('/debug', (req,res) => {
//     res.send(req.body)
// })

app.listen(4000);

// mongodb+srv://blog:zTfFFYCaI4xdCKcn@cluster0.3sh9cxr.mongodb.net/?retryWrites=true&w=majority