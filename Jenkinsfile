pipeline {
    agent {
        label 'ontime-hrms'
    }

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

        stage('SonarQube Quality Check') {
            steps {
                script {
                    def scannerHome = tool 'SonarQubeScanner'
                    withSonarQubeEnv('SonarQube') {
                        sh "${scannerHome}/bin/sonar-scanner"
                    }
                }
            }
        }

        stage("Quality Gate Approval") {
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
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
                        // Tulis credential lalu perbaiki format: Jenkins Secret Text kehilangan newline
                        sh '''
                            echo "$ENV_PROD_CONTENT" > .env.prod
                            # Kembalikan newline sebelum setiap KEY= (huruf kapital + underscore)
                            sed -i -E 's/ ([A-Z][A-Z_]{2,}=)/\\n\\1/g; s/ (#)/\\n\\1/g' .env.prod
                        '''
                    }
                    
                    // Cek apakah agent berjalan secara lokal di target VM (memiliki target directory)
                    def isLocal = sh(script: "[ -d '${TARGET_DIR}' ] && echo 'true' || echo 'false'", returnStdout: true).trim() == 'true'
                    
                    if (isLocal) {
                        echo "Mendeteksi agent berjalan di VM target secara lokal. Menjalankan deployment lokal..."
                        
                        // Copy file secara lokal
                        sh "cp docker-compose.prod.yml ${TARGET_DIR}/docker-compose.prod.yml"
                        sh "cp .env.prod ${TARGET_DIR}/.env.prod"
                        
                        // Verifikasi .env.prod
                        sh "echo \"[VERIFY] .env.prod lines: \$(wc -l < ${TARGET_DIR}/.env.prod), DB_PASSWORD set: \$(grep -c DB_PASSWORD ${TARGET_DIR}/.env.prod)\""
                        
                        // Eksekusi docker compose pull & up secara lokal
                        withCredentials([usernamePassword(credentialsId: "${GHCR_AUTH_ID}", usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
                            sh """
                                cd ${TARGET_DIR}
                                
                                # Login ke GHCR
                                echo "\${GH_TOKEN}" | docker login ${REGISTRY} -u \${GH_USER} --password-stdin
                                
                                echo "Menarik Image Terbaru..."
                                docker compose -f docker-compose.prod.yml pull
                                
                                echo "Mengaktifkan Container Baru..."
                                docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --remove-orphans
                                
                                echo "Membersihkan Image Lama yang Gantung..."
                                docker image prune -f
                                
                                echo "Restart hrms-proxy..."
                                docker restart hrms-proxy
                                
                                echo "Deployment Lokal Sukses!"
                            """
                        }
                    } else {
                        echo "Menjalankan deployment remote via SSH/SCP..."
                        // 2. Hubungkan SSH dan jalankan proses deployment di VM Aplikasi
                        withCredentials([sshUserPrivateKey(credentialsId: "${SSH_CREDENTIAL_ID}", keyFileVariable: 'SSH_KEY')]) {
                            // Transfer docker-compose.prod.yml dan .env.prod ke VM Aplikasi
                            sh "scp -i \${SSH_KEY} -o StrictHostKeyChecking=no docker-compose.prod.yml ${TARGET_VM_USER}@${TARGET_VM_IP}:${TARGET_DIR}/docker-compose.prod.yml"
                            sh "scp -i \${SSH_KEY} -o StrictHostKeyChecking=no .env.prod ${TARGET_VM_USER}@${TARGET_VM_IP}:${TARGET_DIR}/.env.prod"
                            
                            // Verifikasi .env.prod terkirim dengan benar
                            sh "ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no ${TARGET_VM_USER}@${TARGET_VM_IP} 'echo \"[VERIFY] .env.prod lines: \$(wc -l < ${TARGET_DIR}/.env.prod), DB_PASSWORD set: \$(grep -c DB_PASSWORD ${TARGET_DIR}/.env.prod)\"'"
                            
                            // Eksekusi pull dan up di server target
                            withCredentials([usernamePassword(credentialsId: "${GHCR_AUTH_ID}", usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
                                sh """
                                    ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no ${TARGET_VM_USER}@${TARGET_VM_IP} '
                                        cd ${TARGET_DIR}
                                        
                                        # Login ke GHCR di VM Aplikasi agar diizinkan pull image
                                        echo "\${GH_TOKEN}" | docker login ${REGISTRY} -u \${GH_USER} --password-stdin
                                        
                                        echo "Menarik Image Terbaru..."
                                        docker compose -f docker-compose.prod.yml pull
                                        
                                        echo "Mengaktifkan Container Baru..."
                                        docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --remove-orphans
                                        
                                        echo "Membersihkan Image Lama yang Gantung..."
                                        docker image prune -f
                                        
                                        echo "Restart hrms-proxy..."
                                        docker restart hrms-proxy
                                        
                                        echo "Deployment Remote Sukses!"
                                    '
                                """
                            }
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
