sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

#In console window #1
docker-compose up


#in console window #2
sudo apt-get install portaudio19-dev

conda remove --name wenv --all
conda create -n wenv python=3.12.3
conda activate wenv
conda install -c conda-forge libstdcxx-ng

#git clone https://github.com/collabora/WhisperLive.git

#pip install -r requirements/client.txt
pip install -r requirements.txt

#in console window #2
conda activate wenv
python run_client.py



#deploy web-client
cd client
docker compose build
docker push 192.168.8.129:32000/whisper-web-client:1.0.39
