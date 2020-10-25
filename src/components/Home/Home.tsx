import React, { useState, useEffect } from 'react'
import { useFirebase, Firebase } from '../Firebase'
import { Navbar, Nav, Button, ButtonGroup, Container, Row, Col, Spinner, Jumbotron, Image, ProgressBar, OverlayTrigger, Popover, Carousel } from 'react-bootstrap'
import { useSession } from '../Session'
import InputRange from 'react-input-range'
import 'react-input-range/lib/css/index.css'
import styles from './Home.module.css'

import Dance from "../../icons/disco-ball.png"
import Energy from "../../icons/megaphone.png"
import Valence from "../../icons/sun.png"
import Tempo from "../../icons/rhythm.png"

import Icon from "../../icons/icon.png"

import { functions, auth, firestore } from 'firebase'

const HomePage: React.FC = () => {
    const firebase = useFirebase()
    const session = useSession()

    const [currentSong, setCurrentSong] = useState(null as any);
    const [params, setParams] = useState({} as any);
    const [curSongFeatures, setCurSongFeatures] = useState(null as any);

    //list of recs
    const [recsList, setRecsList] = useState(null as any);

    //already played tracks
    const [ignoreTracks, setIgnoreTracks] = useState<Array<string>>([]);
    const [currentRecIndex, setCurrentRecIndex] = useState<number>(0);

    //recommendation
    const [rec, setRec] = useState(null as any);
    const [recSongFeatures, setRecSongFeatures] = useState(null as any);

    //playlists
    //list of user's playlists
    const [playlists, setPlaylists] = useState([] as any);

    //list of playlist objects with tracks
    const [playlistTracksList, setPlaylistTracksList] = useState([] as any);

    //names of playlists that match
    const [playlistMatches, setPlaylistMatches] = useState([] as any);

    //settings
    const [settingsChanged, setSettingsChanged] = useState<boolean>(false);
    const [min_danceability, setMinDance] = useState<number>(0);
    const [min_energy, setMinEnergy] = useState<number>(0);
    const [min_valence, setMinValence] = useState<number>(0);
    const [min_tempo, setMinTempo] = useState<number>(0);

    const [max_danceability, setMaxDance] = useState<number>(1);
    const [max_energy, setMaxEnergy] = useState<number>(1);
    const [max_valence, setMaxValence] = useState<number>(1);
    const [max_tempo, setMaxTempo] = useState<number>(300);

    //active/loading buttons
    //loading for initial Log in with Spotify button
    const [loginLoading, setLoginLoading] = useState<boolean>(false);

    const [refreshActive, setRefreshActive] = useState<boolean>(false);
    const [recActive, setRecActive] = useState<boolean>(false);
    const [recLoading, setRecLoading] = useState<boolean>(false);

    const [searchActive, setSearchActive] = useState<boolean>(false);
    const [searchLoading, setSearchLoading] = useState<boolean>(false);

    //progress bar for playlist search
    const [playlistsGotten, setPlaylistsGotten] = useState<boolean>(false);
    const [totalIndexes, setTotalIndexes] = useState<number>(1);
    const [currentCount, setCurrentCount] = useState<number>(0);

    //used to tell if still loading or no data
    const [noData, setNoData] = useState<boolean>(false);

    //initial parsing of access / refresh tokens
    const getHashParams = () => {
        var hashParams = {} as any;
        var e, r = /([^&;=]+)=?([^&;]*)/g,
            q = window.location.hash.substring(1);
        while (e = r.exec(q)) {
            hashParams[e[1]] = decodeURIComponent(e[2]);
        }
        setParams(hashParams);
        return hashParams;
    }

    //get seed track
    const getCurrentSong = async (pars) => {
        try {
            const currentSongBody = await functions().httpsCallable('getCurrentSong')({ access_token: pars.access_token, refresh_token: pars.refresh_token, uid: auth().currentUser?.uid })
            if (currentSongBody.data) {
                if (currentSongBody.data.access_token) {
                    const new_token = currentSongBody.data.access_token
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

    //analyze track
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
                        setRecLoading(false);
                    }
                }
            }
        } catch (e) {
            console.log(e);
        }
    }

    //executes getCurrentSong and getSongFeatures
    const refreshCurrentSong = async (params) => {
        setRefreshActive(true);
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
                await getSongFeatures(params, curSong.data.item.id, 'current')
            }
        }
        setRefreshActive(false);
    }

    //uses seed track to obtain 10 recommendations at a time
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
            setRecsList(recommendation)
            if (recommendation?.data?.tracks?.length > 0) {
                getLocalRecommendation(newPars, recommendation, song);
            } else {
                setRecsList(null);
                setRec(null);
                setRecSongFeatures(null);
                setRecLoading(false);
            }
        } catch (e) {
            console.log(e);
        }
    }

    //executes if there are still recs left from getRecommendation()
    const getLocalRecommendation = async (pars, recommendation, song) => {
        try {
            var i = currentRecIndex;
            if (ignoreTracks) {
                for (i; i < recommendation.data.tracks.length; i++) {
                    if (ignoreTracks.includes(recommendation.data.tracks[i].id)) {
                        if (i === recommendation.data.tracks.length - 1) {
                            setRecsList(null);
                            setRec(null);
                            setRecSongFeatures(null);
                            setRecLoading(false);
                            setCurrentRecIndex(0);
                        } else {
                            continue;
                        }
                    } else {
                        break;
                    }
                }
            }
            if (i > -1) {
                setRec(recommendation.data.tracks[i]);
                setIgnoreTracks([...ignoreTracks, recommendation.data.tracks[i]])
                getSongFeatures(pars, recommendation.data.tracks[i].id, 'rec');
                if (i < recommendation.data.tracks.length - 1) {
                    setCurrentRecIndex(i + 1);
                } else {
                    setRecsList(null);
                    setCurrentRecIndex(0);
                }
            } else {
                setRec(null);
            }
        } catch (e) {
            console.log(e)
        }
    }

    //obtains a user's playlists for playlist searching
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
                    count += user_plists.data.items.length;
                    setTotalIndexes(count);
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

    //obtains matches
    const findPlaylistMatches = async (pars, song, plists) => {
        try {
            var newPars = pars;
            const plist_tracks_list = [] as any;
            const plist_matches = [] as any;
            var count = 0;
            var total = 0;

            for (let i = 0; i < plists.length; i++) {
                total += plists[i].length;
            }

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
                    count += 1;
                    setCurrentCount(Math.round((count / total) * 100));
                }
            }
            setPlaylistTracksList(plist_tracks_list);
            setPlaylistMatches(plist_matches);
        } catch (e) {
            console.log(e);
        }
    }

    //executes the whole get playlist flow
    const getPlaylistMatches = async (pars, song) => {
        const plist_matches = [] as any;
        var count = 0;
        //Step 4: Match playlists if playlists gotten and indexed
        if (playlists.length > 0) {
            if (playlistTracksList.length > 0) {
                for (let i = 0; i < playlistTracksList.length; i++) {
                    for (let j = 0; j < playlistTracksList[i].tracks.data.items.length; j++) {
                        if (song.name === playlistTracksList[i].tracks.data.items[j].track.name) {
                            plist_matches.push(playlistTracksList[i].name);
                        }
                        count += 1;
                        setCurrentCount(Math.round((count / totalIndexes) * 100));
                    }
                }
                await setPlaylistMatches(plist_matches);
            } else {
                //Step 3: Index playlist tracks if playlists gotten but not indexed
                await findPlaylistMatches(pars, song, playlists);
            }
        } else {
            //Step 1: Retrieve playlists if no playlists gotten
            const plists = await getPlaylists(pars);
            setPlaylistsGotten(true);

            //Step 2: Index playlist tracks & match playlists
            await findPlaylistMatches(pars, song, plists);
        }
        setSearchLoading(false);
    }

    //initial loading of data
    useEffect(() => {
        const getData = async () => {
            try {
                const hashParams = getHashParams();

                if (hashParams.access_token) {
                    setLoginLoading(true);

                    // create new auth user & get customToken
                    const customToken = await functions().httpsCallable('getCustomToken')({ access_token: hashParams.access_token, refresh_token: hashParams.refresh_token, uid: auth().currentUser?.uid })

                    //signin with custom token
                    await auth().signInWithCustomToken(customToken.data.token).catch(e => {
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
            setNoData(true);
        }
    }, [session, firebase])


    //view if playlist search is ongoing
    const playlistsLoadingView = () => {
        return (
            <>
                {
                    playlistsGotten ?
                        <Container style={{ width: '90%' }}>
                            <Row>
                                <div style={{ width: '100%' }}>
                                    <ProgressBar animated variant="info" now={currentCount} />
                                </div>
                            </Row>
                            <Row style={{ display: 'flex', justifyContent: 'center', paddingTop: 25, paddingBottom: 20 }}>
                                <h2>Searching your playlists for matches. This may take a few minutes....</h2>
                            </Row>
                        </Container>
                        :
                        <Container style={{ width: '90%' }}>
                            <Row style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 25 }}>
                                <Spinner animation="grow" variant="danger" />
                                <Spinner animation="grow" variant="primary" />
                                <Spinner animation="grow" variant="warning" />
                                <Spinner animation="grow" variant="info" />
                            </Row>
                            <Row style={{ display: 'flex', justifyContent: 'center', paddingTop: 25, paddingBottom: 20 }}>
                                <h2>Indexing your playlists....</h2>
                            </Row>
                        </Container>
                }
            </>
        )
    }

    //view if playlist search is active
    const playlistsView = () => {
        if (playlistMatches.length < 1) {
            return (
                <Row><h3>This song does not exist in any of your playlists.</h3></Row>
            )
        } else {
            const playlistItems = playlistMatches.map((d) => <Row key={d} style={{ display: 'flex', justifyContent: 'center', width: '90%' }}><h2>{d}</h2></Row>)
            return (
                <div>
                    <Row style={{ display: 'flex', justifyContent: 'center', width: '90%' }}><h3>Found in: </h3></Row>
                    {playlistItems}
                </div>
            )
        }
    }

    //view if recommendation is being retrieved
    const recLoadingView = () => {
        return (
            <Container style={{ width: '90%' }}>
                <Row style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 25 }}>
                    <Spinner animation="grow" variant="danger" />
                    <Spinner animation="grow" variant="primary" />
                    <Spinner animation="grow" variant="warning" />
                    <Spinner animation="grow" variant="info" />
                </Row>
                <Row style={{ display: 'flex', justifyContent: 'center', paddingTop: 25, paddingBottom: 20 }}>
                    <h2 className="text-center">Generating a recommendation....</h2>
                </Row>
            </Container>
        )
    }

    //view if recommendation is active
    const recView = () => {
        return (
            <Container style={{ width: '90%' }}>
                {rec ?
                    <Row>
                        <iframe src={`https://open.spotify.com/embed/track/${rec.id}`} frameBorder="0" width="100%" height="80" allow="encrypted-media"></iframe>
                    </Row>
                    :
                    <Row>
                        <h3>No recommendation found. Try expanding your parameters.</h3>
                    </Row>
                }

                <Row style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10 }}>
                    <h2>Recommended Track Analysis:</h2>
                    <OverlayTrigger placement="bottom" overlay={(
                        <Popover id="popover-basic">
                            <Popover.Title as="h3">
                                Track Analysis
                                </Popover.Title>
                            <Popover.Content>
                                <strong>songness</strong> uses the <strong>Spotify API</strong>, which provides track features such as <strong>Danceability (Rhythm), Energy, Valence, Tempo</strong> and more. For a breakdown on each of these values, interact with the four icons on your bottom toolbar.
                                </Popover.Content>
                        </Popover>)}>
                        <h3>ⓘ</h3>
                    </OverlayTrigger>
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
                                    <Button variant="info" onClick={() => {
                                        setSettingsChanged(true)
                                        setMinDance(recSongFeatures?.data?.danceability)
                                    }
                                    }>Set Min</Button>

                                    <Button variant="info" onClick={() => {
                                        setSettingsChanged(true)
                                        setMaxDance(recSongFeatures?.data?.danceability)
                                    }
                                    }>Set Max</Button>
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
                                            setSettingsChanged(true);
                                            setMinDance(value.min)
                                            setMaxDance(value.max)
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
                                    <Button variant="info" onClick={() => {
                                        setSettingsChanged(true)
                                        setMinEnergy(recSongFeatures?.data?.energy)
                                    }}>
                                        Set Min
                                        </Button>
                                    <Button variant="info" onClick={() => {
                                        setSettingsChanged(true)
                                        setMaxEnergy(recSongFeatures?.data?.energy)
                                    }}>
                                        Set Max
                                        </Button>
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
                                            setSettingsChanged(true)
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
                                    <Button variant="info" onClick={() => {
                                        setSettingsChanged(true)
                                        setMinValence(recSongFeatures?.data?.valence)
                                    }}>Set Min</Button>
                                    <Button variant="info" onClick={() => {
                                        setSettingsChanged(true)
                                        setMaxValence(recSongFeatures?.data?.valence)
                                    }}>Set Max</Button>
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
                                            setSettingsChanged(true);
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
                                    <Button variant="info" onClick={() => {
                                        setSettingsChanged(true)
                                        setMinTempo(recSongFeatures?.data?.tempo)
                                    }}>Set Min</Button>
                                    <Button variant="info" onClick={() => {
                                        setSettingsChanged(true)
                                        setMaxTempo(recSongFeatures?.data?.tempo)
                                    }}>Set Max</Button>
                                </ButtonGroup>
                            </Row>
                            <Row>
                                <InputRange
                                    maxValue={300}
                                    minValue={0}
                                    value={{ min: min_tempo, max: max_tempo }}
                                    onChange={value => {
                                        if (typeof value === 'object') {
                                            setSettingsChanged(true)
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

    //initial screen with no user
    if (!auth().currentUser) {
        return (
            <div>
                <Navbar bg="dark" variant="dark">
                    <Navbar.Brand href="#">
                        <img
                            alt=""
                            src={Icon}
                            width="30"
                            height="30"
                            className="d-inline-block align-top"
                        />{' '}
                            songness
                        </Navbar.Brand>
                </Navbar>
                <Container className={styles.paddingTop}>
                    <Row style={{ paddingBottom: 100, display: 'flex', justifyContent: 'center' }}>
                        <Col lg={5}>
                            <h1>Finetune your music recommendations.</h1>
                            <h3 className={styles.fontLess}>{'{songness}'} translates the tools offered by the Spotify API into simplistic controls, allowing you to adjust the recommendation engine to your liking.</h3>
                        </Col>
                        <Col lg={3} md={6} sm={8} xs={9}>
                            <Carousel fade={true} style={{ paddingTop: 20 }}>
                                <Carousel.Item>
                                    <div className={styles.opaqueLess}>
                                        <img className="d-block w-100"
                                            src={Dance}
                                        />
                                    </div>

                                    <Carousel.Caption>
                                        <h1 className="text-body">Rhythm</h1>
                                        <p className="text-body">measures how danceable a piece of music is.</p>
                                    </Carousel.Caption>
                                </Carousel.Item>
                                <Carousel.Item>
                                    <div className={styles.opaqueLess}>
                                        <img className="d-block w-100"
                                            src={Energy}
                                        />
                                    </div>

                                    <Carousel.Caption>
                                        <h1 className="text-body">Energy</h1>
                                        <p className="text-body">measures how mellow or chaotic a track sounds.</p>
                                    </Carousel.Caption>
                                </Carousel.Item>
                                <Carousel.Item>
                                    <div className={styles.opaqueLess}>
                                        <img className="d-block w-100"
                                            src={Valence}
                                        />
                                    </div>


                                    <Carousel.Caption>
                                        <h1 className="text-body">Valence</h1>
                                        <p className="text-body">measures how sad or upbeat a song feels.</p>
                                    </Carousel.Caption>
                                </Carousel.Item>
                                <Carousel.Item>
                                    <div className={styles.opaqueLess}>
                                        <img className="d-block w-100"
                                            src={Tempo}
                                        />
                                    </div>

                                    <Carousel.Caption >
                                        <h1 className="text-body">Tempo</h1>
                                        <p className="text-body">measures the average beats per minute of a song.</p>
                                    </Carousel.Caption>
                                </Carousel.Item>
                            </Carousel>

                        </Col>
                    </Row>

                    <Row style={{ paddingTop: '25', display: 'flex', justifyContent: 'center' }}>
                        {
                            loginLoading ?
                                <Button variant="info" style={{ width: '90%', paddingLeft: '5%', paddingRight: '5%' }} disabled block>
                                    <Spinner
                                        as="span"
                                        animation="grow"
                                        size="sm"
                                        role="status"
                                        aria-hidden="true"
                                    />
                                    <Spinner
                                        as="span"
                                        animation="grow"
                                        size="sm"
                                        role="status"
                                        aria-hidden="true"
                                    />
                                    <Spinner
                                        as="span"
                                        animation="grow"
                                        size="sm"
                                        role="status"
                                        aria-hidden="true"
                                    />
                                    <Spinner
                                        as="span"
                                        animation="grow"
                                        size="sm"
                                        role="status"
                                        aria-hidden="true"
                                    />
                                </Button>
                                :
                                <Button href='https://us-central1-songness-3bb81.cloudfunctions.net/login' variant="info" style={{ width: '90%', paddingLeft: '5%', paddingRight: '5%' }} onClick={() => { setLoginLoading(true) }} block>
                                    Log in with Spotify
                                </Button>
                        }
                    </Row>
                </Container>
                <Navbar fixed="bottom" bg="dark" variant="dark">
                    <Nav>
                        <Button variant="outline-dark" size="sm" disabled>Preferences</Button>
                    </Nav>
                </Navbar>
            </div>
        )
    }

    //if a seed track exists
    if (currentSong) {
        if (currentSong.data) {
            return (
                <div>
                    <Navbar bg="dark" variant="dark">
                        <Navbar.Brand href="#">
                            <img
                                alt=""
                                src={Icon}
                                width="30"
                                height="30"
                                className="d-inline-block align-top"
                            />{' '}
                            songness
                        </Navbar.Brand>
                        <Nav className="ml-auto">
                            <Button variant="outline-light" size="sm" onClick={() => {
                                setLoginLoading(false);
                                firebase.doSignOut()
                            }}>Sign Out</Button>

                        </Nav>
                    </Navbar>
                    <Container className={styles.paddingTop} >
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
                                        {refreshActive ?
                                            <Button variant="outline-info" disabled>
                                                <Spinner
                                                    as="span"
                                                    animation="grow"
                                                    size="sm"
                                                    role="status"
                                                    aria-hidden="true"
                                                />
                                            </Button>
                                            :
                                            <Button variant="outline-info" onClick={() => {
                                                setRefreshActive(true)
                                                refreshCurrentSong(params)
                                            }}>Refresh</Button>
                                        }

                                    </Col>
                                </Row>
                                <Row style={{ paddingTop: 15 }}>
                                    <Col>
                                        <Row>
                                            <div style={{ width: 50, paddingRight: 10 }}>
                                                <Image src={Dance} fluid />
                                            </div>
                                        </Row>
                                        <Row>
                                            <h3>Rhythm:</h3>
                                        </Row>
                                        <Row>
                                            <h3>
                                                {curSongFeatures?.data?.danceability}
                                            </h3>
                                        </Row>
                                    </Col>
                                    <Col>
                                        <Row>
                                            <div style={{ width: 50, paddingRight: 10 }}>
                                                <Image src={Energy} fluid />
                                            </div>

                                        </Row>
                                        <Row>
                                            <h3>Energy:</h3>
                                        </Row>
                                        <Row>
                                            <h3>
                                                {curSongFeatures?.data?.energy}
                                            </h3>
                                        </Row>
                                    </Col>
                                    <Col>
                                        <Row>
                                            <div style={{ width: 50, paddingRight: 10 }}>
                                                <Image src={Valence} fluid />
                                            </div>

                                        </Row>
                                        <Row>
                                            <h3>Valence:</h3>
                                        </Row>
                                        <Row>
                                            <h3>
                                                {curSongFeatures?.data?.valence}
                                            </h3>
                                        </Row>
                                    </Col>
                                    <Col>
                                        <Row>
                                            <div style={{ width: 50, paddingRight: 10 }}>
                                                <Image src={Tempo} fluid />
                                            </div>

                                        </Row>
                                        <Row>
                                            <h3>Tempo:</h3>
                                        </Row>
                                        <Row>
                                            <h3>
                                                {curSongFeatures?.data?.tempo}
                                            </h3>
                                        </Row>
                                    </Col>
                                </Row>
                                <Row style={{ paddingTop: 15 }}>
                                    {
                                        searchLoading ?
                                            <Button variant="outline-info" onClick={() => {
                                                setRecActive(false);
                                                setRecLoading(false);
                                                setSearchActive(true);
                                            }} active={searchActive} block>
                                                <Spinner
                                                    as="span"
                                                    animation="grow"
                                                    size="sm"
                                                    role="status"
                                                    aria-hidden="true"
                                                />
                                                <Spinner
                                                    as="span"
                                                    animation="grow"
                                                    size="sm"
                                                    role="status"
                                                    aria-hidden="true"
                                                />
                                                <Spinner
                                                    as="span"
                                                    animation="grow"
                                                    size="sm"
                                                    role="status"
                                                    aria-hidden="true"
                                                />
                                                <Spinner
                                                    as="span"
                                                    animation="grow"
                                                    size="sm"
                                                    role="status"
                                                    aria-hidden="true"
                                                />
                                            </Button>
                                            :
                                            <Button variant="outline-info" onClick={() => {
                                                setRecActive(false);
                                                setRecLoading(false);
                                                setSearchActive(true);
                                                setSearchLoading(true);
                                                getPlaylistMatches(params, currentSong.data.item)
                                            }} active={searchActive} block>
                                                Playlist Search
                                        </Button>
                                    }
                                </Row>

                                <Row style={{ paddingTop: 20 }}>
                                    {recLoading ?
                                        <Button variant="info" disabled block>
                                            <Spinner
                                                as="span"
                                                animation="grow"
                                                size="sm"
                                                role="status"
                                                aria-hidden="true"
                                            />
                                            <Spinner
                                                as="span"
                                                animation="grow"
                                                size="sm"
                                                role="status"
                                                aria-hidden="true"
                                            />
                                            <Spinner
                                                as="span"
                                                animation="grow"
                                                size="sm"
                                                role="status"
                                                aria-hidden="true"
                                            />
                                            <Spinner
                                                as="span"
                                                animation="grow"
                                                size="sm"
                                                role="status"
                                                aria-hidden="true"
                                            />
                                        </Button>
                                        :
                                        <Button variant="info" onClick={() => {
                                            setSearchActive(false);
                                            setRecActive(true);
                                            setRecLoading(true);
                                            if (recsList?.data) {
                                                if (settingsChanged) {
                                                    getRecommendation(params, currentSong.data.item.id)
                                                } else {
                                                    getLocalRecommendation(params, recsList, currentSong.data.item.id)
                                                }
                                            } else {
                                                getRecommendation(params, currentSong.data.item.id)
                                            }
                                            setSettingsChanged(false);
                                        }} active={recActive} block>
                                            Recommendation
                                        </Button>
                                    }

                                </Row>

                            </Container>
                        </Jumbotron>
                        {recActive ?
                            recLoading ?
                                recLoadingView()
                                :
                                recView()
                            :
                            searchActive ?
                                searchLoading ?
                                    playlistsLoadingView()
                                    :
                                    playlistsView()
                                :
                                <Row className={styles.paddingTop}></Row>
                        }
                    </Container>
                    <Navbar fixed="bottom" bg="dark" variant="dark">
                        <Nav className="ml-auto">
                            <OverlayTrigger placement="top" overlay={(
                                <Popover id="popover-basic">
                                    <Popover.Title as="h3">
                                        Rhythm
                                </Popover.Title>
                                    <Popover.Content>
                                        <strong>Rhythm</strong> describes how suitable a track is for <strong>dancing</strong> based on a combination of musical elements including tempo, rhythm stability, beat strength, and overall regularity. A value of 0.0 is least danceable and 1.0 is most danceable.
                                    </Popover.Content>
                                </Popover>)}>
                                <Image src={Dance} style={{ width: 30, height: 30, marginRight: 15 }} />
                            </OverlayTrigger>

                            <OverlayTrigger placement="top" overlay={(
                                <Popover id="popover-basic">
                                    <Popover.Title as="h3">
                                        Energy
                                </Popover.Title>
                                    <Popover.Content>
                                        <strong>Energy</strong> is a measure from 0.0 to 1.0 and represents a perceptual measure of <strong>intensity and activity.</strong> Typically, energetic tracks feel fast, loud, and noisy. For example, death metal has high energy, while a Bach prelude scores low on the scale. Perceptual features contributing to this attribute include dynamic range, perceived loudness, timbre, onset rate, and general entropy.
                                    </Popover.Content>
                                </Popover>)}>
                                <Image src={Energy} style={{ width: 30, height: 30, marginRight: 15 }} />
                            </OverlayTrigger>

                            <OverlayTrigger placement="top" overlay={(
                                <Popover id="popover-basic">
                                    <Popover.Title as="h3">
                                        Valence
                                </Popover.Title>
                                    <Popover.Content>
                                        <strong>Valence</strong> is a measure from 0.0 to 1.0 describing the musical <strong>positiveness</strong> conveyed by a track. Tracks with high valence sound more positive (e.g. happy, cheerful, euphoric), while tracks with low valence sound more negative (e.g. sad, depressed, angry).
                                    </Popover.Content>
                                </Popover>)}>
                                <Image src={Valence} style={{ width: 30, height: 30, marginRight: 15 }} />
                            </OverlayTrigger>

                            <OverlayTrigger placement="top" overlay={(
                                <Popover id="popover-basic">
                                    <Popover.Title as="h3">
                                        Tempo
                                </Popover.Title>
                                    <Popover.Content>
                                        <strong>Tempo</strong> is the overall estimated tempo of a track in beats per minute (BPM). In musical terminology, tempo is the <strong>speed or pace</strong> of a given piece and derives directly from the average beat duration.
                                    </Popover.Content>
                                </Popover>)}>
                                <Image src={Tempo} style={{ width: 30, height: 30, marginRight: 15 }} />
                            </OverlayTrigger>
                        </Nav>
                    </Navbar>
                </div>
            )
        }
    }

    //if logged in but no seed track
    return (
        <div>
            <Navbar bg="dark" variant="dark">
                <Navbar.Brand href="#">
                    <img
                        alt=""
                        src={Icon}
                        width="30"
                        height="30"
                        className="d-inline-block align-top"
                    />{' '}
                            songness
                </Navbar.Brand>
                <Nav className="ml-auto">
                    <Button variant="outline-light" size="sm" onClick={() => {
                        setLoginLoading(false);
                        firebase.doSignOut()
                    }}>Sign Out</Button>

                </Nav>
            </Navbar>
            {noData ?
                <Container className={styles.paddingTop}>
                    <Jumbotron>
                        <Row style={{ display: 'flex', justifyContent: 'center' }}>
                            <h2 className='text-center'>Play a song from your Spotify client.</h2>
                        </Row>
                        <Row style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 25, paddingBottom: 50 }}>
                            <Col>
                                <Image src={Dance} fluid />
                            </Col>
                            <Col>
                                <Image src={Energy} fluid />
                            </Col>
                            <Col>
                                <Image src={Valence} fluid />
                            </Col>
                            <Col>
                                <Image src={Tempo} fluid />
                            </Col>

                        </Row>

                    </Jumbotron>
                    <Row style={{ paddingLeft: '4%', paddingRight: '4%' }}>
                        {
                            refreshActive ?
                                <Button variant="info" disabled block>
                                    <Spinner
                                        as="span"
                                        animation="grow"
                                        size="sm"
                                        role="status"
                                        aria-hidden="true"
                                    />
                                    <Spinner
                                        as="span"
                                        animation="grow"
                                        size="sm"
                                        role="status"
                                        aria-hidden="true"
                                    />
                                    <Spinner
                                        as="span"
                                        animation="grow"
                                        size="sm"
                                        role="status"
                                        aria-hidden="true"
                                    />
                                    <Spinner
                                        as="span"
                                        animation="grow"
                                        size="sm"
                                        role="status"
                                        aria-hidden="true"
                                    />
                                </Button>
                                :
                                <Button variant="info" onClick={() => {
                                    setRefreshActive(true);
                                    refreshCurrentSong(params)
                                }} block>Refresh</Button>
                        }
                    </Row>

                </Container>
                :
                <Container className={styles.paddingTop}>
                    <Jumbotron>
                        <Row style={{ display: 'flex', justifyContent: 'space-between' }} >
                            <Spinner animation="grow" variant="danger" />
                            <Spinner animation="grow" variant="primary" />
                            <Spinner animation="grow" variant="warning" />
                            <Spinner animation="grow" variant="info" />
                        </Row>
                    </Jumbotron>
                </Container>
            }
            <Navbar fixed="bottom" bg="dark" variant="dark">
                <Nav>
                    <Button variant="outline-dark" size="sm" disabled>Preferences</Button>
                </Nav>
            </Navbar>
        </div >
    )
}

export { HomePage }
