// frontend_modern/src/components/Accordion.tsx
import React, { useState } from 'react';

interface AccordionProps {
    title: string;
    children: React.ReactNode;
}

const Accordion: React.FC<AccordionProps> = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="accordion-item">
            <button className="accordion-title" onClick={() => setIsOpen(!isOpen)}>
                <span>{title}</span>
                <span className={`material-symbols-rounded ${isOpen ? 'open' : ''}`}>
                    expand_more
                </span>
            </button>
            <div className={`accordion-content ${isOpen ? 'open' : ''}`}>
                {children}
            </div>
        </div>
    );
};

export default Accordion;