// audio-worklet.js
class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.sampleRate = sampleRate;
        this.targetSampleRate = 16000;
        this.ratio = this.sampleRate / this.targetSampleRate;
        this.buffer = [];
        this.chunkSize = 1600; // 100ms at 16kHz
    }
    
    process(inputs) {
        const input = inputs[0];
        if (!input || input.length === 0) return true;
        
        const inputData = input[0];
        
        // Add current samples to buffer
        for (let i = 0; i < inputData.length; i++) {
            this.buffer.push(inputData[i]);
        }
        
        // Calculate input samples needed for one output chunk
        const inputSamplesNeeded = Math.ceil(this.chunkSize * this.ratio);
        
        // Process while we have enough data
        while (this.buffer.length >= inputSamplesNeeded) {
            const chunkBuffer = this.buffer.slice(0, inputSamplesNeeded);
            this.buffer = this.buffer.slice(inputSamplesNeeded);
            
            // Resample the chunk
            const resampledData = this.resample(chunkBuffer);
            
            if (resampledData.length > 0) {
                // Send resampled float16 data to main thread
                this.port.postMessage({
                    type: 'audioData',
                    data: resampledData
                });
                
                // Calculate RMS for visualization
                let sum = 0;
                for (let i = 0; i < resampledData.length; i++) {
                    sum += resampledData[i] * resampledData[i];
                }
                const rms = Math.sqrt(sum / resampledData.length);
                this.port.postMessage({
                    type: 'volume',
                    value: rms
                });
            }
        }
        
        return true;
    }
    
    resample(input) {
        const output = new Float32Array(this.chunkSize);
        
        for (let i = 0; i < this.chunkSize; i++) {
            const index = i * this.ratio;
            const leftIndex = Math.floor(index);
            
            // Handle edge cases
            if (leftIndex >= input.length - 1) {
                output[i] = input[input.length - 1];
                continue;
            }
            
            const rightIndex = leftIndex + 1;
            const fraction = index - leftIndex;
            
            // Linear interpolation
            output[i] = input[leftIndex] * (1 - fraction) + 
                        input[rightIndex] * fraction;
        }
        
        return output;
    }
}

registerProcessor('audio-processor', AudioProcessor);
