// src/components/TestimonialsCarousel.js

import React, { useState } from 'react';
import styles from './TestimonialsCarousel.module.css';

const testimonials = [
    {
        quote: "We use Centrifugo to power real time updates and chat. It's been incredibly easy to use and reliable.",
        author: "Victor Pontis, Founder at Luma",
    },
    {
        quote: "Migrating from our custom WebSocket setup to Centrifugo felt like trading a DIY van for a Ferrari.",
        author: "Leonardo N., Founder & CEO at Noguel",
    },
    {
        quote: "Centrifugo listed in our tech radar, and new projects will use it by default.",
        author: "Marko Kevac, Engineering Manager at Badoo",
    },
    {
        quote: "Nine months in production, and we didn't encounter any issue with Centrifugo – it performed flawlessly!",
        author: "Kirill, CTO at RabbitX",
    }
];

function TestimonialsCarousel() {
    const [activeIndex, setActiveIndex] = useState(0);

    const handlePrev = () => {
        setActiveIndex((prevIndex) => 
            prevIndex === 0 ? testimonials.length - 1 : prevIndex - 1
        );
    };

    const handleNext = () => {
        setActiveIndex((prevIndex) => 
            prevIndex === testimonials.length - 1 ? 0 : prevIndex + 1
        );
    };

    return (
        <div className={styles.carousel}>
            <button className={styles.switch} onClick={handlePrev}>{"<"}</button>
            <div className={styles.testimonial}>
                <blockquote className={styles.quote}>“{testimonials[activeIndex].quote}”</blockquote>
                <p className={styles.author}>- {testimonials[activeIndex].author}</p>
            </div>
            <button className={styles.switch} onClick={handleNext}>{">"}</button>
        </div>
    );
}

export default TestimonialsCarousel;
