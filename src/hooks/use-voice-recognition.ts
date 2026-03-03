"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export const useVoiceRecognition = () => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        // Determine browser support
        const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setError("Este navegador no soporta el reconocimiento de voz.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false; // Stop after one result
        recognition.interimResults = true; // Show results while speaking
        recognition.lang = "es-MX"; // Localized for the user

        recognition.onstart = () => {
            setIsListening(true);
            setError(null);
        };

        recognition.onresult = (event: any) => {
            const current = event.resultIndex;
            const transcriptValue = event.results[current][0].transcript;
            setTranscript(transcriptValue);
        };

        recognition.onerror = (event: any) => {
            setError(`Error de voz: ${event.error}`);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
    }, []);

    const startListening = useCallback(() => {
        if (recognitionRef.current && !isListening) {
            setTranscript("");
            recognitionRef.current.start();
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
        }
    }, [isListening]);

    return {
        isListening,
        transcript,
        error,
        startListening,
        stopListening,
    };
};
