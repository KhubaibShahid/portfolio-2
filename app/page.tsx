import About from "@/components/About";
import Hero from "@/components/Hero";
import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Projects from "@/components/Projects";
import Showreel from "@/components/Showreel";

export default function Home() {
  return (
    <>
      <Loader />
      <Nav />
      <main>
        <Hero />
        <About />
        <Showreel />
        <Projects />
      </main>
    </>
  );
}
