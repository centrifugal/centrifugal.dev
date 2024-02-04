import React, { useState, useEffect } from 'react';
import styles from './ImageRotator.module.css';

const images = [
    '/img/pro_carousel_1.png',
    '/img/pro_carousel_2.png',
    '/img/pro_carousel_3.png',
    '/img/pro_carousel_4.png',
];

const ImageRotator = () => {
    const [currentImage, setCurrentImage] = useState(0);

    useEffect(() => {
        const intervalId = setInterval(() => {
            setCurrentImage((prevImage) => (prevImage + 1) % images.length);
        }, 1500);

        return () => clearInterval(intervalId); // Cleanup interval on component unmount
    }, []);

    return (
        <div className={styles.imageContainer}>
            <img src={images[currentImage]} alt="Rotating Image" className={styles.rotatingImage} />
        </div>
    );
};

export default ImageRotator;
