import React, { useState, useEffect} from 'react'
import {
    BrowserRouter as Router,
    Switch,
    Route,
} from "react-router-dom"

import { ROUTES } from '../../constants'
import { HomePage } from '../Home'
import { useFirebase } from '../Firebase'
import { useSession, SessionContext } from '../Session/'

const MainApp: React.FC = () => {
    const session = useSession()

    if (session.initializing) {
        return (<div></div>)
    }
    return (
        <Router>
            <Switch>
                <Route path={ROUTES.ROOT}>
                    <HomePage />
                </Route>
            </Switch>
        </Router>
    )
}


const AppWithAuth: React.FC = () => {
    const firebase = useFirebase()
    const [authObject, setAuthObject] = useState(() => {
        const currentUser = firebase.auth.currentUser
        if (!currentUser) {
            return {
                initializing: true,
                auth: null,
            }
        } else {
            return {
                initializing: false,
                auth: currentUser,
            }
        }

    })

    useEffect(() => {
        function onChange(newUser: any) {
            console.log('New user detected in auth onChange: ', newUser)
            if (newUser === null) {
                // Not authenticated
                console.log('Not authenticated')
                setAuthObject({ initializing: false, auth: null })
            } else {
                // New authentication occurred
                setAuthObject(prevState => {
                    if (prevState.auth === null) {
                        // Went from unauthenticated to authenticated
                        console.log('Authenticated')
                        return { initializing: false, auth: newUser }
                    } else {
                        // Bug: Went from authenticated to another authentication
                        console.log('Bug: reauthenticated')
                        return prevState
                    }
                })
            }
        }

        // listen for auth state changes
        const unsubscribe = firebase.auth.onAuthStateChanged(onChange)
        // unsubscribe to the listener when unmounting

        return () => {
            unsubscribe()
            // We loaded a prof and were listening to it
        }
    }, [firebase.auth])

    return (
        <SessionContext.Provider value={authObject}>
            <MainApp />
        </SessionContext.Provider>
    )
}

export default AppWithAuth