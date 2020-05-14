import React, { useState, useEffect } from 'react'
import { useFirebase, Firebase } from '../Firebase'
import { Button, Container, Row, Col, Spinner } from 'react-bootstrap'
import { useSession } from '../Session'
import styles from './Home.module.css'
import { functions, auth } from 'firebase'

const HomePage: React.FC = () => {
    const firebase = useFirebase()
    const session = useSession()

    const [params, setParams] = useState({} as any);
    const [user, setUser] = useState(null);

    const getHashParams = () => {
        var hashParams = {} as any;
        var e, r = /([^&;=]+)=?([^&;]*)/g,
            q = window.location.hash.substring(1);
        while (e = r.exec(q)) {
            hashParams[e[1]] = decodeURIComponent(e[2]);
        }
        console.log(hashParams)
        return hashParams;
    }

    useEffect(() => {
        const getData = async () => {
            try {
                const hashParams = getHashParams();
                console.log(hashParams);
                setParams(hashParams);

                //create new auth user
                const customToken = await functions().httpsCallable('getCustomToken')({ access_token: hashParams.access_token })

                console.log('customToken = ', customToken)
            } catch (e) {
                alert(e)
            }
        }

        getData()
    }, [session, firebase])

    return (
        <Container className={styles.paddingTop}>
            <Row className={styles.paddingTop}>
                <h1>Your access code is: {params.access_code}</h1>
            </Row>
            <Row className={styles.paddingTop}>
                <Button><a href='/login'>Start</a></Button>
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
