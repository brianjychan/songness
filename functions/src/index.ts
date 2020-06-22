import * as functions from 'firebase-functions';
//import e = require('express');
const admin = require('firebase-admin');
admin.initializeApp();

//const express = require('express'); // Express web server framework
const request = require('request'); // "Request" library
const rp = require('request-promise');
const errors = require('request-promise/errors');
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

    const scope = 'user-read-private user-read-email user-read-playback-state playlist-read-private playlist-read-collaborative';
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
                try {
                    admin.auth().createUser({
                        uid: uid,
                        email: bod.email,
                        displayName: bod.display_name,
                    })
                } catch (e) {
                    console.log(e)
                }
                admin.firestore().collection('users').doc(uid).set({ ...bod, access_token: access_token, refresh_token: refresh_token }).catch(e => { console.log(e) })
                //admin.firestore().collection('users').doc(uid).update({ access_token: access_token, refresh_token: refresh_token })
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

const getNewAccessToken = (async (data) => {
    const uid = data.uid;
    const refresh_token = data.refresh_token;
    const authOptions = {
        method: 'POST',
        url: 'https://accounts.spotify.com/api/token',
        headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    };

    return rp(authOptions)
        .then((body) => {
            console.log(body);
            const new_access_token = body.access_token;
            admin.firestore().collection('users').doc(uid).update({ access_token: new_access_token }).catch(e => { console.log(e) })
            return { access_token: new_access_token }
        }).catch(err => {
            console.log(err)
        })
})

exports.getCustomToken = functions.https.onCall(async (data, context) => {
    console.log('data = ', data);
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
        .catch(errors.StatusCodeError, async (err) => {
            console.log(err);
            if (err.statusCode === 401) {
                return getNewAccessToken(data)
            }
        })
});

exports.getCurrentSong = functions.https.onCall(async (data, context) => {
    console.log('data = ', data);
    const access_token = data.access_token;
    const options = {
        url: 'https://api.spotify.com/v1/me/player/currently-playing',
        headers: { 'Authorization': 'Bearer ' + access_token },
        json: true
    };

    return rp(options)
        .then(async (bod) => {
            console.log('bod = ', bod);
            return bod;
        })
        .catch(errors.StatusCodeError, async (err) => {
            console.log('err.statusCode = ', err.statusCode);
            if (err.statusCode === 401) {
                return getNewAccessToken(data);
            }
        })
})

exports.getSongFeatures = functions.https.onCall(async (data, context) => {
    console.log('data =', data);
    const access_token = data.access_token;
    const songID = data.songID;
    const options = {
        url: `https://api.spotify.com/v1/audio-features/${songID}`,
        headers: { 'Authorization': 'Bearer ' + access_token },
        json: true
    };

    return rp(options)
        .then(async (bod) => {
            console.log('bod = ', bod);
            return bod;
        })
        .catch(errors.StatusCodeError, async (err) => {
            console.log(err);
            if (err.statusCode === 401) {
                return getNewAccessToken(data)
            }
        })
})

exports.getRecommendation = functions.https.onCall(async (data, context) => {
    console.log('data = ', data);
    const songID = data.songID
    const access_token = data.access_token;
    const queryParams = data.queryParams;
    const options = {
        url: 'https://api.spotify.com/v1/recommendations?' + querystring.stringify({
            ...queryParams,
            limit: 1,
            seed_tracks: [songID]
        }),
        headers: { 'Authorization': 'Bearer ' + access_token },
        json: true
    };

    return rp(options)
        .then(async (bod) => {
            console.log('bod = ', bod);
            return bod;
        })
        .catch(errors.StatusCodeError, async (err) => {
            console.log(err);
            if (err.statusCode === 401) {
                return getNewAccessToken(data)
            }
        })
})

exports.getPlaylists = functions.https.onCall(async (data, context) => {
    console.log('data = ', data);
    const access_token = data.access_token;
    const userID = context.auth?.uid;
    const options = {
        url: `https://api.spotify.com/v1/users/${userID}/playlists?` + querystring.stringify({
            limit: 50,
            offset: data.offset
        }),
        headers: { 'Authorization': 'Bearer ' + access_token },
        json: true
    };

    return rp(options)
        .then(async (bod) => {
            console.log('bod = ', bod);
            return bod;
        })
        .catch(errors.StatusCodeError, async (err) => {
            console.log(err);
            if (err.statusCode === 401) {
                return getNewAccessToken(data)
            }
        })
})


exports.getPlaylistTracks = functions.https.onCall(async (data, context) => {
    console.log('data = ', data);
    const access_token = data.access_token;
    const playlistID = data.playlistID;
    const options = {
        url: `https://api.spotify.com/v1/playlists/${playlistID}/tracks?` + querystring.stringify({
            limit: 100
        }),
        headers: { 'Authorization': 'Bearer ' + access_token },
        json: true
    };

    return rp(options)
        .then(async (bod) => {
            console.log('bod = ', bod);
            return bod;
        })
        .catch(errors.StatusCodeError, async (err) => {
            console.log(err);
            if (err.statusCode === 401) {
                return getNewAccessToken(data)
            }
        })
})

/*exports.playRecommendation = functions.https.onCall(async (data, context) => {
    console.log('data = ', data);
    const songID = data.songID
    const access_token = data.access_token;
    const options = {
        method: 'PUT',
        url: 'https://api.spotify.com/v1/me/player/play',
        form: { "uris": [`spotify:track:${songID}`] },
        headers: { 'Authorization': 'Bearer ' + access_token },
        json: true
    }

    return rp(options)
        .then(bod => {
            console.log(bod)
            return 1;
        })
        .catch(errors.StatusCodeError, async (err) => {
            console.log(err);
            if (err.statusCode === 41) {
                return getNewAccessToken(data)
            }
        })
})*/

//const main = express();
//main.use('*/start', app)

//exports.main = functions.https.onRequest(main);