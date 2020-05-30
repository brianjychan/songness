import React, { useState, useEffect } from 'react'
import { useFirebase, Firebase } from '../Firebase'
import { Button, Container, Row, Col, Spinner } from 'react-bootstrap'
import { useSession } from '../Session'
import Iframe from 'react-iframe'
import styles from './Home.module.css'
import { functions, auth, firestore } from 'firebase'

const HomePage: React.FC = () => {
    const firebase = useFirebase()
    const session = useSession()

    //const [params, setParams] = useState({} as any);
    const [currentSong, setCurrentSong] = useState(null as any);
    const [params, setParams] = useState({} as any);
    const [curSongFeatures, setCurSongFeatures] = useState(null as any);
    const [rec, setRec] = useState(null as any);
    const [recSongFeatures, setRecSongFeatures] = useState(null as any);

    //playlists
    const [playlists, setPlaylists] = useState([] as any);
    const [playlistTracksList, setPlaylistTracksList] = useState([] as any);
    const [playlistMatches, setPlaylistMatches] = useState([] as any);

    //settings
    const [min_danceability, setMinDance] = useState<Number>();
    const [min_energy, setMinEnergy] = useState<Number>();
    const [min_valence, setMinValence] = useState<Number>();
    const [min_tempo, setMinTempo] = useState<Number>();

    const [max_danceability, setMaxDance] = useState<Number>();
    const [max_energy, setMaxEnergy] = useState<Number>();
    const [max_valence, setMaxValence] = useState<Number>();
    const [max_tempo, setMaxTempo] = useState<Number>();


    const getHashParams = () => {
        var hashParams = {} as any;
        var e, r = /([^&;=]+)=?([^&;]*)/g,
            q = window.location.hash.substring(1);
        while (e = r.exec(q)) {
            hashParams[e[1]] = decodeURIComponent(e[2]);
        }
        console.log(hashParams)
        setParams(hashParams);
        return hashParams;
    }


    const getCurrentSong = async (pars) => {
        try {
            const currentSongBody = await functions().httpsCallable('getCurrentSong')({ access_token: pars.access_token, refresh_token: pars.refresh_token, uid: auth().currentUser?.uid })
            if (currentSongBody.data) {
                if (currentSongBody.data.access_token) {
                    const new_token = currentSongBody.data.access_token
                    console.log('exchanging token: new_token = ', new_token)
                    setParams({ ...params, access_token: new_token })
                    return getCurrentSong({ access_token: new_token, refresh_token: pars.refresh_token });
                } else {
                    setCurrentSong(currentSongBody);
                    return currentSongBody;
                }
            }
        } catch (e) {
            console.log(e);
        }
    }

    const getSongFeatures = async (pars, song, type) => {
        try {
            const curSongFeats = await functions().httpsCallable('getSongFeatures')({ access_token: pars.access_token, refresh_token: pars.refresh_token, songID: song, uid: auth().currentUser?.uid })
            if (curSongFeats.data) {
                if (curSongFeats.data.access_token) {
                    const newToken = curSongFeats.data.access_token
                    setParams({ ...params, access_token: newToken })
                    return getSongFeatures({ access_token: newToken, refresh_token: pars.refresh_token }, song, type);
                } else {
                    if (type === 'current') {
                        setCurSongFeatures(curSongFeats)
                    } else {
                        setRecSongFeatures(curSongFeats);
                    }
                }
            }
        } catch (e) {
            console.log(e);
        }
    }

    const refreshCurrentSong = async (params) => {
        const curSong = await getCurrentSong(params);
        if (curSong) {
            if (curSong.data) {
                getSongFeatures(params, curSong.data.item.id, 'current')
            }
        }
    }

    const getRecommendation = async (pars, song) => {
        try {
            var newPars = pars
            const settings = { 'min_danceability': min_danceability, 'min_energy': min_energy, 'min_valence': min_valence, 'min_tempo': min_tempo, 'max_danceability': max_danceability, 'max_energy': max_energy, 'max_valence': max_valence, 'max_tempo': max_tempo };
            let queryParams = {}
            for (const keyName of Object.keys(settings)) {
                if (settings[keyName]) {
                    queryParams = { ...queryParams, [keyName]: settings[keyName] };
                }
            }
            var recommendation = await functions().httpsCallable('getRecommendation')({ access_token: newPars.access_token, refresh_token: newPars.refresh_token, songID: song, queryParams: queryParams })
            if (recommendation?.data?.access_token) {
                const newToken = recommendation.data.access_token
                setParams({ ...params, access_token: newToken })
                newPars = ({ ...newPars, access_token: newToken })
                recommendation = await functions().httpsCallable('getRecommendation')({ access_token: newPars.access_token, refresh_token: newPars.refresh_token, songID: song, queryParams: queryParams })
            }
            setRec(recommendation)
            getSongFeatures(newPars, recommendation.data.tracks[0].id, 'rec');
        } catch (e) {
            console.log(e);
        }
    }

    const getPlaylists = async (pars) => {
        try {
            var newPars = pars;
            const plists = [] as any;
            let count = 0;
            while (true) {
                var user_plists = await functions().httpsCallable('getPlaylists')({ access_token: newPars.access_token, refresh_token: newPars.refresh_token, offset: count })
                if (user_plists?.data?.access_token) {
                    const newToken = user_plists.data.access_token
                    setParams({ ...params, access_token: newToken })
                    newPars = ({ ...newPars, access_token: newToken })
                    user_plists = await functions().httpsCallable('getPlaylists')({ access_token: newPars.access_token, refresh_token: newPars.refresh_token, offset: count })
                }
                plists.push(user_plists.data.items);
                if (user_plists.data.items.length < 50) {
                    break;
                } else {
                    count += 50;
                }
            }
            setPlaylists(plists);
            return plists;
        } catch (e) {
            console.log(e);
        }
    }

    const findPlaylistMatches = async (pars, song, plists) => {
        try {
            var newPars = pars;
            const plist_tracks_list = [] as any;
            const plist_matches = [] as any;
            for (let i = 0; i < plists.length; i++) {
                for (let j = 0; j < plists[i].length; j++) {
                    var plist_tracks = await functions().httpsCallable('getPlaylistTracks')({ access_token: newPars.access_token, refresh_token: newPars.refresh_token, playlistID: plists[i][j].id })
                    if (plist_tracks?.data?.access_token) {
                        const newToken = plist_tracks.data.access_token
                        setParams({ ...params, access_token: newToken })
                        newPars = ({ ...newPars, access_token: newToken })
                        plist_tracks = await functions().httpsCallable('getPlaylistTracks')({ access_token: newPars.access_token, refresh_token: newPars.refresh_token, playlistID: plists[i][j].id })
                    }
                    plist_tracks_list.push({ name: plists[i][j].name, tracks: plist_tracks });
                    for (let k = 0; k < plist_tracks.data.items.length; k++) {
                        if (song.name === plist_tracks.data.items[k].track.name) {
                            plist_matches.push(plists[i][j].name);
                        }
                    }
                }
            }
            setPlaylistTracksList(plist_tracks_list);
            setPlaylistMatches(plist_matches);
        } catch (e) {
            console.log(e);
        }
    }

    const getPlaylistMatches = async (pars, song) => {
        const plist_matches = [] as any;
        if (playlists.length > 0) {
            if (playlistTracksList.length > 0) {
                for (let i = 0; i < playlistTracksList.length; i++) {
                    for (let j = 0; j < playlistTracksList[i].tracks.data.items.length; j++) {
                        if (song.name === playlistTracksList[i].tracks.data.items[j].track.name) {
                            plist_matches.push(playlistTracksList[i].name);
                        }
                    }
                }
                setPlaylistMatches(plist_matches);
            } else {
                findPlaylistMatches(pars, song, playlists);
            }
        } else {
            const plists = await getPlaylists(pars);
            findPlaylistMatches(pars, song, plists);
        }
    }

    /*const playRecommendation = async (pars, song) => {
        try {
            console.log(pars);
            const play = await functions().httpsCallable('playRecommendation')({ access_token: pars.access_token, refresh_token: pars.refresh_token, songID: song, uid: auth().currentUser?.uid })
            if (play?.data?.access_token) {
                const new_token = play.data.access_token
                setParams({ ...params, access_token: new_token })
                return playRecommendation({ access_token: new_token, refresh_token: pars.refresh_token }, song);
            } else {
                console.log(play.data);
            }
        } catch (e) {
            console.log(e);
        }
    }*/

    useEffect(() => {
        const getData = async () => {
            try {
                const hashParams = getHashParams();
                console.log('hashParams = ', hashParams);

                if (hashParams.access_token) {

                    //create new auth user & get customToken
                    const customToken = await functions().httpsCallable('getCustomToken')({ access_token: hashParams.access_token, refresh_token: hashParams.refresh_token, uid: auth().currentUser?.uid })

                    //signin with custom token
                    auth().signInWithCustomToken(customToken.data.token).catch(e => {
                        console.log(e);
                    })
                }
            } catch (e) {
                console.log(e);
            }
        }

        const loadData = async () => {
            try {
                const userDoc = await firebase.db.collection('users').doc(auth().currentUser?.uid).get();
                const userParams = { access_token: userDoc.data()?.access_token, refresh_token: userDoc.data()?.refresh_token };
                console.log('userParams = ', userParams);
                setParams(userParams);
                return userParams;
            } catch (e) {
                console.log(e);
            }
        }

        if (!auth().currentUser) {
            getData()
        } else {
            loadData().then(userParams => refreshCurrentSong(userParams))
        }
    }, [session, firebase])


    const playlistsView = () => {
        if (!playlistMatches) {
            return ''
        } else {
            const playlistItems = playlistMatches.map((d) => <li key={d}>{d}</li>)
            return (
                <div>
                    {playlistItems}
                </div>
            )
        }
    }

    const recView = () => {
        if (!rec) {
            return ''
        } else {
            return (
                <Row>
                    <Row>
                        <h2>{rec?.data?.tracks[0]?.name} by {rec?.data?.tracks[0]?.artists[0].name}</h2>
                    </Row>
                    <Row>
                        <Col>
                            <Row>
                                <Button onClick={() => setMaxDance(recSongFeatures?.data?.danceability)}>Set Max</Button>
                            </Row>
                            <Row>
                                <h3>Danceability: {recSongFeatures?.data?.danceability}</h3>
                            </Row>
                            <Row>
                                <Button onClick={() => setMinDance(recSongFeatures?.data?.danceability)}>Set Min</Button>
                            </Row>
                        </Col>
                        <Col>
                            <Row>
                                <Button onClick={() => setMaxEnergy(recSongFeatures?.data?.energy)}>Set Max</Button>
                            </Row>
                            <Row>
                                <h3>Energy: {recSongFeatures?.data?.energy}</h3>
                            </Row>
                            <Row>
                                <Button onClick={() => setMinEnergy(recSongFeatures?.data?.energy)}>Set Min</Button>
                            </Row>
                        </Col>
                        <Col>
                            <Row>
                                <Button onClick={() => setMaxValence(recSongFeatures?.data?.valence)}>Set Max</Button>
                            </Row>
                            <Row>
                                <h3>Valence: {recSongFeatures?.data?.valence}</h3>
                            </Row>
                            <Row>
                                <Button onClick={() => setMinValence(recSongFeatures?.data?.valence)}>Set Min</Button>
                            </Row>
                        </Col>
                        <Col>
                            <Row>
                                <Button onClick={() => setMaxTempo(recSongFeatures?.data?.tempo)}>Set Max</Button>
                            </Row>
                            <Row>
                                <h3>Tempo: {recSongFeatures?.data?.tempo}</h3>
                            </Row>
                            <Row>
                                <Button onClick={() => setMinTempo(recSongFeatures?.data?.tempo)}>Set Min</Button>
                            </Row>

                        </Col>
                    </Row>
                    <Row>
                        <Iframe url={`https://open.spotify.com/embed/track/${rec?.data?.tracks[0]?.id}`} allow='encrypted-media' />
                    </Row>
                    <Row>
                        <Col>
                            <h3>Min Danceability: {min_danceability}</h3>
                        </Col>
                        <Col>
                            <h3>Max Danceability: {max_danceability}</h3>
                        </Col>
                    </Row>
                    <Row>
                        <Col>
                            <h3>Min Energy: {min_energy}</h3>
                        </Col>
                        <Col>
                            <h3>Max Energy: {max_energy}</h3>
                        </Col>
                    </Row>
                    <Row>
                        <Col>
                            <h3>Min Valence: {min_valence}</h3>
                        </Col>
                        <Col>
                            <h3>Max Valence: {max_valence}</h3>
                        </Col>
                    </Row>
                    <Row>
                        <Col>
                            <h3>Min Tempo: {min_tempo}</h3>
                        </Col>
                        <Col>
                            <h3>Max Tempo: {max_tempo}</h3>
                        </Col>
                    </Row>
                </Row>
                /*<Row>
                            <Col>
                                <h3>Danceability: {curSongFeatures?.data?.danceability}</h3>
                            </Col>
                            <Col>
                                <h3>Energy: {curSongFeatures?.data?.energy}</h3>
                            </Col>
                            <Col>
                                <h3>Valence: {curSongFeatures?.data?.valence}</h3>
                            </Col>
                            <Col>
                                <h3>Tempo: {curSongFeatures?.data?.tempo}</h3>
                            </Col>
                        </Row>*/
            )
        }
    }

    if (!auth().currentUser) {
        return (
            <Container className={styles.paddingTop}>
                <Row className={styles.paddingTop}>
                    <h1>songness</h1>
                </Row>
                <Row className={styles.paddingTop}>
                    <a href='https://us-central1-songness-9ae05.cloudfunctions.net/login'>Start</a>
                </Row>
            </Container>
        )
    }


    if (currentSong) {
        if (currentSong.data) {
            return (
                <Container className={styles.paddingTop}>
                    <Row className={styles.paddingTop}>
                        <h1>Welcome, {auth().currentUser?.displayName}</h1>
                    </Row>
                    <Row>
                        <Col>
                            <h2>Your current song: {currentSong.data.item.name} by {currentSong.data.item.artists[0].name}</h2>
                        </Col>
                        <Col>
                            <Button onClick={() => { refreshCurrentSong(params) }}>Refresh</Button>
                        </Col>
                    </Row>
                    <Row>
                        <Col>
                            <h3>Danceability: {curSongFeatures?.data?.danceability}</h3>
                        </Col>
                        <Col>
                            <h3>Energy: {curSongFeatures?.data?.energy}</h3>
                        </Col>
                        <Col>
                            <h3>Valence: {curSongFeatures?.data?.valence}</h3>
                        </Col>
                        <Col>
                            <h3>Tempo: {curSongFeatures?.data?.tempo}</h3>
                        </Col>
                    </Row>
                    <Row className={styles.paddingTop}>
                        <Col>
                            <Button onClick={() => { getRecommendation(params, currentSong.data.item.id) }}>Generate Recommendation</Button>
                        </Col>
                        <Col>
                            <Button onClick={() => { getPlaylistMatches(params, currentSong.data.item) }}>Playlist Search</Button>
                        </Col>
                    </Row>
                    <div>
                        {playlistsView()}
                    </div>
                    <div>
                        {recView()}
                    </div>
                    <Row className={styles.paddingTop}>
                        <Button onClick={() => { firebase.doSignOut() }}>Sign Out</Button>
                    </Row>
                </Container>
            )
        }
    }

    //console.log('params check = ', params);
    return (
        <Container className={styles.paddingTop}>
            <Row className={styles.paddingTop}>
                <h1>Welcome, {auth().currentUser?.displayName}</h1>
            </Row>
            <Row>
                <Col>
                    <h2>Play a song from your Spotify client.</h2>
                </Col>
                <Col>
                    <Button onClick={() => {
                        console.log('params before getSong = ', params)
                        refreshCurrentSong(params)
                    }}>Refresh</Button>
                </Col>
            </Row>
            <Row className={styles.paddingTop}>
                <Button onClick={() => { firebase.doSignOut() }}>Sign Out</Button>
            </Row>
        </Container>
    )
    /*useEffect(() => {
        accessFirestore()
    }, [accessFirestore])
    console.log()
    if (session.auth) {
        return (
            <div>
                <p>Home</p>
                <p>Logged in!</p>
                <Button variant="info" onClick={() => { firebase.doSignOut() }}>Sign Out</Button>
 
            </div>
        )
    } else {
        return (
            <div>
                <p>Home</p>
                <Button variant="info" onClick={() => { firebase.doTwitterSignIn() }}>Sign In to Twitter</Button>
            </div>
        )
    }*/
}

export { HomePage }
