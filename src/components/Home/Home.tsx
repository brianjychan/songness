import React, { useState, useEffect } from 'react'
import { useFirebase, Firebase } from '../Firebase'
import { Button, Container, Row, Col, Spinner } from 'react-bootstrap'
import { useSession } from '../Session'
import styles from './Home.module.css'
import { functions, auth } from 'firebase'

const HomePage: React.FC = () => {
    const firebase = useFirebase()
    const session = useSession()

    //const [params, setParams] = useState({} as any);
    const [currentSong, setCurrentSong] = useState(null as any);
    const [params, setParams] = useState({} as any);

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

    const getCurrentSong = async (params) => {
        try {
            console.log('params = ', params);
            const currentSongBody = await functions().httpsCallable('getCurrentSong')({ access_token: params.access_token })
            console.log('currentSongBody = ', currentSongBody);
            setCurrentSong(currentSongBody);
        } catch (e) {
            console.log(e);
        }
    }

    useEffect(() => {
        const getData = async () => {
            try {
                const hashParams = getHashParams();
                console.log('hashParams = ', hashParams);

                if (hashParams.access_token) {

                    //create new auth user & get customToken
                    const customToken = await functions().httpsCallable('getCustomToken')({ access_token: hashParams.access_token })

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
                console.log(userParams);
                return userParams;
                //setParams(userParams);
            } catch (e) {
                console.log(e);
            }
        }

        if (!auth().currentUser) {
            getData()
        } else {
            loadData().then((params) => {
                getCurrentSong(params);
            })
        }
    }, [session, firebase])

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
                        <h3>Your current song: {currentSong.data.item.name} by {currentSong.data.item.artists[0].name}</h3>
                    </Row>
                    <Row>
                        <Button onClick={() => { getCurrentSong(params) }}>Refresh</Button>
                    </Row>
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
                    <Button onClick={() => { getCurrentSong(params) }}>Refresh</Button>
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
