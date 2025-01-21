import Logo from "../assets/Logo.svg";
import "./Home.scss";
const Home = () => {

    console.timeEnd("appinit")

    return (
        <div>
            <div class="rechess-logo">
                <Logo />
            </div>
            <div class="rechess-title">Re:Chess</div>
        </div>
    );
};

export default Home;
