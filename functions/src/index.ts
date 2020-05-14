import * as functions from 'firebase-functions';
const admin = require('firebase-admin');
admin.initializeApp();

//const express = require('express'); // Express web server framework
const request = require('request'); // "Request" library
const rp = require('request-promise');
//const cors = require('cors');
const querystring = require('querystring');
//const cookieParser = require('cookie-parser');*/

const client_id = '352d765702214b98a6b4c35b4012c392'; // Your client id
const client_secret = functions.config().clientinfo.secret; // Your secret
const redirect_uri = 'http://us-central1-songness-9ae05.cloudfunctions.net/callback'; // Your redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
const generateRandomString = function (length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

//const stateKey = 'spotify_auth_state';

/*const app = express();

app.use(express.static(__dirname + '/build'))
    .use(cors())
    .use(cookieParser());*/

exports.login = functions.https.onRequest((req, res) => {
    const state = generateRandomString(16);
    res.set('Set-Cookie', `__session=${state};`);

    const scope = 'user-read-private user-read-email';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        }));
});

exports.callback = functions.https.onRequest((req, res) => {
    // your application requests refresh and access tokens
    // after checking the state parameter
    const code = req.query.code || null;
    //const state = req.query.state || null;
    //const storedState = req.cookies ? req.cookies['__session'] : null;

    /*if (state === null || state !== storedState) {
        res.redirect('http://localhost:3000/#' +
            querystring.stringify({
                error: 'state_mismatch',
                state: state,
                storedState: storedState,
            }));*/
    // } else {
    res.clearCookie('__session');
    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        form: {
            code: code,
            redirect_uri: redirect_uri,
            grant_type: 'authorization_code'
        },
        headers: {
            'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
        },
        json: true
    };

    request.post(authOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {

            const access_token = body.access_token,
                refresh_token = body.refresh_token;

            const options = {
                url: 'https://api.spotify.com/v1/me',
                headers: { 'Authorization': 'Bearer ' + access_token },
                json: true
            };

            // use the access token to access the Spotify Web API
            request.get(options, function (err, result, bod) {
                const uid = bod.id;
                admin.auth().createUser({
                    uid: uid,
                    email: bod.email,
                    displayName: bod.display_name,
                })
                admin.firestore().collection('users').doc(uid).set(bod)
            });

            // we can also pass the token to the browser to make requests from there
            res.redirect('http://localhost:3000/#' +
                querystring.stringify({
                    access_token: access_token,
                    refresh_token: refresh_token
                }));
        } else {
            res.redirect('http://localhost:3000/#' +
                querystring.stringify({
                    response: response.statusCode
                }));
        }
    });
    // }
})

exports.getCustomToken = functions.https.onCall(async (data, context) => {
    console.log('data = ', data)
    const access_token = data.access_token;
    const options = {
        url: 'https://api.spotify.com/v1/me',
        headers: { 'Authorization': 'Bearer ' + access_token },
        json: true
    };

    return rp(options)
        .then(async (bod) => {
            console.log('bod = ', bod);
            const uid = bod.id;
            return admin.auth().createCustomToken(uid)
                .then(customToken => {
                    console.log('customToken = ', customToken)
                    return { 'token': customToken }
                })
        })
        .catch((err) => {
            console.log(err);
        })
    /*
    request.get(options, function (err, result, bod) {
        return bod;
        const uid = bod.id;
        admin.auth().createCustomToken(uid)
            .then(customToken => {
                console.log('customToken = ', customToken)
                return { 'token': customToken }
            });
        */
});

//app.get('*/callback', function (req, res) {

    // your application requests refresh and access tokens
    // after checking the state parameter
/*
    const code = req.query.code || null;
    const state = req.query.state || null;
    const storedState = req.cookies ? req.cookies[stateKey] : null;

    if (state === null || state !== storedState) {
        res.redirect('/#' +
            querystring.stringify({
                error: 'state_mismatch'
            }));
    } else {
        res.clearCookie(stateKey);
        const authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code: code,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
            },
            json: true
        };

        request.post(authOptions, function (error, response, body) {
            if (!error && response.statusCode === 200) {

                const access_token = body.access_token,
                    refresh_token = body.refresh_token;

                const options = {
                    url: 'https://api.spotify.com/v1/me',
                    headers: { 'Authorization': 'Bearer ' + access_token },
                    json: true
                };

                // use the access token to access the Spotify Web API
                request.get(options, function (err, result, bod) {
                    console.log(bod);
                });

                // we can also pass the token to the browser to make requests from there
                res.redirect('/#' +
                    querystring.stringify({
                        access_token: access_token,
                        refresh_token: refresh_token
                    }));
            } else {
                res.redirect('/#' +
                    querystring.stringify({
                        error: 'invalid_token'
                    }));
            }
        });
    }
});*/

//app.get('*/refresh_token', function (req, res) {

    // requesting access token from refresh token
/*
    const refresh_token = req.query.refresh_token;
    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    };

    request.post(authOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            const access_token = body.access_token;
            res.send({
                'access_token': access_token
            });
        }
    });
});
*/
//const main = express();
//main.use('*/start', app)

//exports.main = functions.https.onRequest(main);