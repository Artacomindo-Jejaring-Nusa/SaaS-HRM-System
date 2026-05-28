pipeline {
    agent any

    environment {
        // Konfigurasi Registry GHCR
        REGISTRY = 'ghcr.io'
        IMAGE_OWNER = 'ahmad-rizki21'
        BACKEND_IMAGE = "${REGISTRY}/${IMAGE_OWNER}/saas-backend:latest"
        FRONTEND_IMAGE = "${REGISTRY}/${IMAGE_OWNER}/saas-frontend:latest"
        
        // Target Server Deployment (VM Aplikasi)
        TARGET_VM_IP = '192.168.222.5'
        TARGET_VM_USER = 'root'
        TARGET_DIR = '/home/hrms/actions-runner/_work/SaaS-HRM-System/SaaS-HRM-System'
        
        // Kredensial ID di Jenkins
        SSH_CREDENTIAL_ID = 'vm-app-ssh'
        GHCR_AUTH_ID = 'github-registry-auth'
        ENV_PROD_ID = 'env-prod-secret'
    }

    stages {
        stage('Checkout Source Code') {
            steps {
                // Menarik repositori otomatis dari Git SCM
                checkout scm
            }
        }

        stage('Build & Push Docker Images') {
            steps {
                script {
                    // Login ke GHCR menggunakan kredensial Jenkins (Username & PAT)
                    withCredentials([usernamePassword(credentialsId: "${GHCR_AUTH_ID}", usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
                        sh "echo \${GH_TOKEN} | docker login ${REGISTRY} -u \${GH_USER} --password-stdin"
                        
                        echo "Membangun Image Backend..."
                        sh "docker build -t ${BACKEND_IMAGE} -f ./backend/Dockerfile ./backend"
                        sh "docker push ${BACKEND_IMAGE}"
                        
                        echo "Membangun Image Frontend..."
                        sh "docker build --build-arg NEXT_PUBLIC_API_URL=https://ontime.jelantik.com/api -t ${FRONTEND_IMAGE} -f ./frontend/Dockerfile ./frontend"
                        sh "docker push ${FRONTEND_IMAGE}"
                    }
                }
            }
        }

        stage('Deploy to VM Production') {
            steps {
                script {
                    // 1. Tulis file .env.prod secara lokal di Jenkins VM dari credentials
                    withCredentials([string(credentialsId: "${ENV_PROD_ID}", variable: 'ENV_PROD_CONTENT')]) {
                        writeFile file: '.env.prod', text: env.ENV_PROD_CONTENT
                    }
                    
                    // 2. Hubungkan SSH dan jalankan proses deployment di VM Aplikasi
                    withCredentials([sshUserPrivateKey(credentialsId: "${SSH_CREDENTIAL_ID}", keyFileVariable: 'SSH_KEY')]) {
                        // Transfer docker-compose.prod.yml dan .env.prod ke VM Aplikasi
                        sh "scp -i \${SSH_KEY} -o StrictHostKeyChecking=no docker-compose.prod.yml ${TARGET_VM_USER}@${TARGET_VM_IP}:${TARGET_DIR}/docker-compose.prod.yml"
                        sh "scp -i \${SSH_KEY} -o StrictHostKeyChecking=no .env.prod ${TARGET_VM_USER}@${TARGET_VM_IP}:${TARGET_DIR}/.env.prod"
                        
                        // Eksekusi pull dan up di server target
                        withCredentials([usernamePassword(credentialsId: "${GHCR_AUTH_ID}", usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
                            sh """
                                ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no ${TARGET_VM_USER}@${TARGET_VM_IP} '
                                    cd ${TARGET_DIR}
                                    
                                    # Login ke GHCR di VM Aplikasi agar diizinkan pull image
                                    echo "${GH_TOKEN}" | docker login ${REGISTRY} -u ${GH_USER} --password-stdin
                                    
                                    echo "Menarik Image Terbaru..."
                                    docker compose -f docker-compose.prod.yml pull
                                    
                                    echo "Mengaktifkan Container Baru..."
                                    docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --remove-orphans
                                    
                                    echo "Membersihkan Image Lama yang Gantung..."
                                    docker image prune -f
                                    
                                    echo "Deployment Sukses!"
                                '
                            """
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            // Bersihkan workspace dan file sementara .env.prod demi keamanan
            sh "rm -f .env.prod"
            cleanWs()
        }
    }
}
