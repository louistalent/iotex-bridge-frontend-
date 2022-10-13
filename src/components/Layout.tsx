/* import React from 'react'; */
import {Link} from "react-router-dom";
import { useSelector} from 'react-redux';
const Layout = (props:any) => {
    const G = useSelector((state:StoreObject) => state);
	const L = G.L;

    return (<>
        <header>
            <Link className="title flex middle" to="/">
                <img src="/banner-dark.png" style={{height:'auto'}} alt="logo" />
                <span className="badge">{L['bridge']}</span>
            </Link>
        </header>
        <main>
            {props.children}
        </main>
        
        <footer>
        </footer>
    </>);
}

export default Layout;