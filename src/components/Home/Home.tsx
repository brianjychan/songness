import React, { useState, useEffect } from 'react'
import { useFirebase, Firebase } from '../Firebase'
import { Button, ButtonGroup, Container, Row, Col, Spinner, Jumbotron, Image } from 'react-bootstrap'
import { useSession } from '../Session'
import InputRange from 'react-input-range'
import 'react-input-range/lib/css/index.css'
import styles from './Home.module.css'

import Dance from "../../icons/disco-ball.png"
import Energy from "../../icons/megaphone.png"
import Valence from "../../icons/sun.png"
import Tempo from "../../icons/rhythm.png"

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
    const [min_danceability, setMinDance] = useState<number>(0);
    const [min_energy, setMinEnergy] = useState<number>(0);
    const [min_valence, setMinValence] = useState<number>(0);
    const [min_tempo, setMinTempo] = useState<number>(0);

    const [max_danceability, setMaxDance] = useState<number>(1);
    const [max_energy, setMaxEnergy] = useState<number>(1);
    const [max_valence, setMaxValence] = useState<number>(1);
    const [max_tempo, setMaxTempo] = useState<number>(300);


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
        setMinDance(0)
        setMinEnergy(0)
        setMinValence(0)
        setMinTempo(0)

        setMaxDance(1)
        setMaxEnergy(1)
        setMaxValence(1)
        setMaxTempo(300)
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
                <Container>
                    <Row>
                        <iframe src={`https://open.spotify.com/embed/track/${rec?.data?.tracks[0]?.id}`} frameBorder="0" width="100%" height="80" allow="encrypted-media"></iframe>
                    </Row>
                    <Container className="centerItems">
                        <Row style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 25, paddingBottom: 20 }}>
                            <Col xs="4" lg="3" style={{ paddingBottom: 15, marginRight: 15 }}>
                                <Image src={Dance} fluid />
                            </Col>
                            <Col>
                                <Row style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 40 }}>
                                    <h2>Rhythm: {recSongFeatures?.data?.danceability}</h2>
                                    <ButtonGroup>
                                        <Button variant="info" onClick={() => setMinDance(recSongFeatures?.data?.danceability)}>Set Min</Button>

                                        <Button variant="info" onClick={() => setMaxDance(recSongFeatures?.data?.danceability)}>Set Max</Button>
                                    </ButtonGroup>
                                </Row>
                                <Row>
                                    <InputRange
                                        maxValue={1}
                                        minValue={0}
                                        step={0.01}
                                        value={{ min: min_danceability, max: max_danceability }}
                                        formatLabel={(value, type) => {
                                            return value.toFixed(3);
                                        }}
                                        onChange={value => {
                                            if (typeof value === 'object') {
                                                setMinDance(value.min)
                                                setMaxDance(value.max)
                                                console.log(value)
                                            }
                                        }} />
                                </Row>
                            </Col>
                        </Row>
                        <Row style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 25, paddingBottom: 20 }}>
                            <Col xs="4" lg="3" style={{ paddingBottom: 15, marginRight: 15 }}>
                                <Image src={Energy} fluid />
                            </Col>
                            <Col>
                                <Row style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 40 }}>
                                    <h2>Energy: {recSongFeatures?.data?.energy}</h2>
                                    <ButtonGroup>
                                        <Button variant="info" onClick={() => setMinEnergy(recSongFeatures?.data?.energy)}>Set Min</Button>
                                        <Button variant="info" onClick={() => setMaxEnergy(recSongFeatures?.data?.energy)}>Set Max</Button>
                                    </ButtonGroup>
                                </Row>
                                <Row>
                                    <InputRange
                                        maxValue={1}
                                        minValue={0}
                                        step={0.01}
                                        value={{ min: min_energy, max: max_energy }}
                                        formatLabel={(value, type) => {
                                            return value.toFixed(3);
                                        }}
                                        onChange={value => {
                                            if (typeof value === 'object') {
                                                setMinEnergy(value.min)
                                                setMaxEnergy(value.max)
                                            }
                                        }} />
                                </Row>
                            </Col>

                        </Row>
                        <Row style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 25, paddingBottom: 20 }}>
                            <Col xs="4" lg="3" style={{ paddingBottom: 15, marginRight: 15 }}>
                                <Image src={Valence} fluid />
                            </Col>
                            <Col>
                                <Row style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 40 }}>
                                    <h2>Valence: {recSongFeatures?.data?.valence}</h2>
                                    <ButtonGroup>
                                        <Button variant="info" onClick={() => setMinValence(recSongFeatures?.data?.valence)}>Set Min</Button>
                                        <Button variant="info" onClick={() => setMaxValence(recSongFeatures?.data?.valence)}>Set Max</Button>
                                    </ButtonGroup>
                                </Row>
                                <Row>
                                    <InputRange
                                        maxValue={1}
                                        minValue={0}
                                        step={0.01}
                                        value={{ min: min_valence, max: max_valence }}
                                        formatLabel={(value, type) => {
                                            return value.toFixed(3);
                                        }}
                                        onChange={value => {
                                            if (typeof value === 'object') {
                                                setMinValence(value.min)
                                                setMaxValence(value.max)
                                            }
                                        }} />
                                </Row>
                            </Col>
                        </Row>
                        <Row style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 25, paddingBottom: 20 }}>
                            <Col xs="4" lg="3" style={{ paddingBottom: 15, marginRight: 15 }}>
                                <Image src={Tempo} fluid />
                            </Col>
                            <Col>
                                <Row style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 40 }}>
                                    <h2>Tempo: {recSongFeatures?.data?.tempo}</h2>
                                    <ButtonGroup>
                                        <Button variant="info" onClick={() => setMinTempo(recSongFeatures?.data?.tempo)}>Set Min</Button>
                                        <Button variant="info" onClick={() => setMaxTempo(recSongFeatures?.data?.tempo)}>Set Max</Button>
                                    </ButtonGroup>
                                </Row>
                                <Row>
                                    <InputRange
                                        maxValue={300}
                                        minValue={0}
                                        value={{ min: min_tempo, max: max_tempo }}
                                        onChange={value => {
                                            if (typeof value === 'object') {
                                                setMinTempo(value.min)
                                                setMaxTempo(value.max)
                                            }
                                        }} />
                                </Row>

                            </Col>

                        </Row>
                    </Container>
                </Container>
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
                    <Jumbotron>
                        <Container>
                            <Row>
                                <Col>
                                    <Row>
                                        <h2>{currentSong.data.item.name}</h2>
                                    </Row>
                                    <Row>
                                        <h2>{currentSong.data.item.artists[0].name}</h2>
                                    </Row>
                                </Col>
                                <Col xs="4">
                                    <Button variant="outline-info" onClick={() => { refreshCurrentSong(params) }}>Refresh ⟲</Button>
                                </Col>
                            </Row>
                            <Row>
                                <Col>
                                    <Row>
                                        <div style={{ width: 50, paddingRight: 10 }}>
                                            <Image src={Dance} fluid />
                                        </div>
                                        <h3>Rhythm: {curSongFeatures?.data?.danceability}</h3>
                                    </Row>
                                </Col>
                                <Col>
                                    <Row>
                                        <div style={{ width: 50, paddingRight: 10 }}>
                                            <Image src={Energy} fluid />
                                        </div>
                                        <h3>Energy: {curSongFeatures?.data?.energy}</h3>
                                    </Row>
                                </Col>
                                <Col>
                                    <Row>
                                        <div style={{ width: 50, paddingRight: 10 }}>
                                            <Image src={Valence} fluid />
                                        </div>
                                        <h3>Valence: {curSongFeatures?.data?.valence}  </h3>
                                    </Row>
                                </Col>
                                <Col>
                                    <Row>
                                        <div style={{ width: 50, paddingRight: 10 }}>
                                            <Image src={Tempo} fluid />
                                        </div>
                                        <h3>Tempo: {curSongFeatures?.data?.tempo}</h3>
                                    </Row>
                                </Col>
                            </Row>
                            <Row className={styles.paddingTop} style={{ display: 'flex' }}>
                                <ButtonGroup>
                                    <Button variant="info" style={{ marginRight: 25 }} onClick={() => { getRecommendation(params, currentSong.data.item.id) }}>Recommendation</Button>
                                    <Button variant="info" onClick={() => { getPlaylistMatches(params, currentSong.data.item) }}>Playlist Search</Button>
                                </ButtonGroup>
                            </Row>
                        </Container>
                    </Jumbotron>
                    <div>
                        {playlistsView()}
                    </div>
                    <div>
                        {recView()}
                    </div>
                    <Row className={styles.paddingTop}>
                        <Button variant="outline-info" onClick={() => { firebase.doSignOut() }}>Sign Out</Button>
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
                    <Button variant="outline-info" onClick={() => {
                        console.log('params before getSong = ', params)
                        refreshCurrentSong(params)
                    }}>Refresh ⟲</Button>
                </Col>
            </Row>
            <Row className={styles.paddingTop}>
                <Button variant="outline-info" onClick={() => { firebase.doSignOut() }}>Sign Out</Button>
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
