pipeline {
    agent {
        label 'ontime-hrms'
    }

    environment {
        // Konfigurasi Registry GHCR
        REGISTRY = 'ghcr.io'
        IMAGE_OWNER = 'ahmad-rizki21'
        BACKEND_IMAGE_NAME = "${REGISTRY}/${IMAGE_OWNER}/saas-backend"
        FRONTEND_IMAGE_NAME = "${REGISTRY}/${IMAGE_OWNER}/saas-frontend"
        
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
                checkout scm
                script {
                    def branch = (env.BRANCH_NAME ?: env.GIT_BRANCH ?: 'main').replace('origin/', '')
                    echo "=========================================================="
                    echo " Mendeteksi Branch Aktif: [${branch}]"
                    echo "=========================================================="
                }
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

        stage('Build & Push Docker Images (Staging)') {
            when {
                expression {
                    def branch = (env.BRANCH_NAME ?: env.GIT_BRANCH ?: '').replace('origin/', '')
                    return branch == 'staging'
                }
            }
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: "${GHCR_AUTH_ID}", usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
                        sh "echo \${GH_TOKEN} | docker login ${REGISTRY} -u \${GH_USER} --password-stdin"
                        
                        echo "Membangun Image Backend (Staging)..."
                        sh "docker build -t ${BACKEND_IMAGE_NAME}:staging -f ./backend/Dockerfile ./backend"
                        sh "docker push ${BACKEND_IMAGE_NAME}:staging"
                        
                        echo "Membangun Image Frontend (Staging)..."
                        sh "docker build --build-arg NEXT_PUBLIC_API_URL=http://${TARGET_VM_IP}:8088/api -t ${FRONTEND_IMAGE_NAME}:staging -f ./frontend/Dockerfile ./frontend"
                        sh "docker push ${FRONTEND_IMAGE_NAME}:staging"
                    }
                }
            }
        }

        stage('Deploy to VM Staging') {
            when {
                expression {
                    def branch = (env.BRANCH_NAME ?: env.GIT_BRANCH ?: '').replace('origin/', '')
                    return branch == 'staging'
                }
            }
            steps {
                script {
                    echo "=========================================================="
                    echo " Memulai Deployment Lingkungan STAGING (Port 8088)"
                    echo "=========================================================="
                    
                    // Siapkan file .env.staging
                    sh '''
                        if [ -f .env.staging.example ]; then
                            cp .env.staging.example .env.staging
                        fi
                    '''
                    
                    def isLocal = sh(script: "[ -d '${TARGET_DIR}' ] && echo 'true' || echo 'false'", returnStdout: true).trim() == 'true'
                    
                    if (isLocal) {
                        sh "cp docker-compose.staging.yml ${TARGET_DIR}/docker-compose.staging.yml"
                        sh "mkdir -p ${TARGET_DIR}/docker/nginx"
                        sh "cp docker/nginx/proxy-staging.conf ${TARGET_DIR}/docker/nginx/proxy-staging.conf"
                        
                        withCredentials([usernamePassword(credentialsId: "${GHCR_AUTH_ID}", usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
                            sh """
                                cd ${TARGET_DIR}
                                echo "\${GH_TOKEN}" | docker login ${REGISTRY} -u \${GH_USER} --password-stdin
                                
                                # Jika .env.staging belum ada, buat dari .env.prod yang sudah aktif
                                if [ ! -f .env.staging ]; then
                                    if [ -f .env.prod ]; then
                                        echo "Membuat .env.staging aman dari .env.prod yang sudah ada..."
                                        cp .env.prod .env.staging
                                        sed -i 's/^DB_DATABASE=.*/DB_DATABASE=hrm_saas_staging/' .env.staging
                                        sed -i 's/^APP_ENV=.*/APP_ENV=staging/' .env.staging
                                        sed -i 's|^APP_URL=.*|APP_URL=http://${TARGET_VM_IP}:8088|' .env.staging
                                        sed -i 's|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://${TARGET_VM_IP}:8088/api|' .env.staging
                                    elif [ -f .env.staging.example ]; then
                                        cp .env.staging.example .env.staging
                                    fi
                                fi
                                
                                # Buat database staging jika belum ada
                                docker exec -i hrms-mysql-master mysql -uroot -pOnTimeNarwastugo2026 -e "CREATE DATABASE IF NOT EXISTS hrm_saas_staging;" || true
                                
                                echo "Menarik Image Staging..."
                                docker compose -f docker-compose.staging.yml pull
                                
                                echo "Mengaktifkan Container Staging..."
                                docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --remove-orphans
                                
                                echo "Menjalankan migrasi database Staging..."
                                sleep 5
                                docker exec -i hrms-backend-staging php artisan migrate --force || true
                                
                                echo "Deployment Staging Sukses! Akses via: http://${TARGET_VM_IP}:8088"
                            """
                        }
                    } else {
                        withCredentials([sshUserPrivateKey(credentialsId: "${SSH_CREDENTIAL_ID}", keyFileVariable: 'SSH_KEY')]) {
                            sh "scp -i \${SSH_KEY} -o StrictHostKeyChecking=no docker-compose.staging.yml ${TARGET_VM_USER}@${TARGET_VM_IP}:${TARGET_DIR}/docker-compose.staging.yml"
                            sh "ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no ${TARGET_VM_USER}@${TARGET_VM_IP} 'mkdir -p ${TARGET_DIR}/docker/nginx'"
                            sh "scp -i \${SSH_KEY} -o StrictHostKeyChecking=no docker/nginx/proxy-staging.conf ${TARGET_VM_USER}@${TARGET_VM_IP}:${TARGET_DIR}/docker/nginx/proxy-staging.conf"
                            
                            withCredentials([usernamePassword(credentialsId: "${GHCR_AUTH_ID}", usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
                                sh """
                                    ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no ${TARGET_VM_USER}@${TARGET_VM_IP} '
                                        cd ${TARGET_DIR}
                                        echo "\${GH_TOKEN}" | docker login ${REGISTRY} -u \${GH_USER} --password-stdin
                                        
                                        # Jika .env.staging belum ada, buat dari .env.prod yang sudah aktif
                                        if [ ! -f .env.staging ]; then
                                            if [ -f .env.prod ]; then
                                                echo "Membuat .env.staging aman dari .env.prod yang sudah ada..."
                                                cp .env.prod .env.staging
                                                sed -i "s/^DB_DATABASE=.*/DB_DATABASE=hrm_saas_staging/" .env.staging
                                                sed -i "s/^APP_ENV=.*/APP_ENV=staging/" .env.staging
                                                sed -i "s|^APP_URL=.*|APP_URL=http://${TARGET_VM_IP}:8088|" .env.staging
                                                sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://${TARGET_VM_IP}:8088/api|" .env.staging
                                            elif [ -f .env.staging.example ]; then
                                                cp .env.staging.example .env.staging
                                            fi
                                        fi
                                        
                                        docker exec -i hrms-mysql-master mysql -uroot -pOnTimeNarwastugo2026 -e "CREATE DATABASE IF NOT EXISTS hrm_saas_staging;" || true
                                        docker compose -f docker-compose.staging.yml pull
                                        docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --remove-orphans
                                        sleep 5
                                        docker exec -i hrms-backend-staging php artisan migrate --force || true
                                        echo "Deployment Staging Sukses! Akses via: http://${TARGET_VM_IP}:8088"
                                    '
                                """
                            }
                        }
                    }
                }
            }
        }

        stage('Build & Push Docker Images (Production)') {
            when {
                expression {
                    def branch = (env.BRANCH_NAME ?: env.GIT_BRANCH ?: '').replace('origin/', '')
                    return branch == 'main'
                }
            }
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: "${GHCR_AUTH_ID}", usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
                        sh "echo \${GH_TOKEN} | docker login ${REGISTRY} -u \${GH_USER} --password-stdin"
                        
                        echo "Membangun Image Backend (Production)..."
                        sh "docker build -t ${BACKEND_IMAGE_NAME}:latest -f ./backend/Dockerfile ./backend"
                        sh "docker push ${BACKEND_IMAGE_NAME}:latest"
                        
                        echo "Membangun Image Frontend (Production)..."
                        sh "docker build --build-arg NEXT_PUBLIC_API_URL=https://ontime.jelantik.com/api -t ${FRONTEND_IMAGE_NAME}:latest -f ./frontend/Dockerfile ./frontend"
                        sh "docker push ${FRONTEND_IMAGE_NAME}:latest"
                    }
                }
            }
        }

        stage('Approval: Rilis ke Server Produksi') {
            when {
                expression {
                    def branch = (env.BRANCH_NAME ?: env.GIT_BRANCH ?: '').replace('origin/', '')
                    return branch == 'main'
                }
            }
            steps {
                timeout(time: 24, unit: 'HOURS') {
                    input message: '⚠️ PERHATIAN: Anda akan merilis update ini ke Server PRODUKSI (ontime.jelantik.com).\nApakah pengujian di Staging sudah CLEAR dan aman?', 
                          ok: 'Ya, Lanjutkan Rilis ke Produksi!'
                }
            }
        }

        stage('Deploy to VM Production') {
            when {
                expression {
                    def branch = (env.BRANCH_NAME ?: env.GIT_BRANCH ?: '').replace('origin/', '')
                    return branch == 'main'
                }
            }
            steps {
                script {
                    echo "=========================================================="
                    echo " Memulai Deployment Lingkungan PRODUKSI (ontime.jelantik.com)"
                    echo "=========================================================="
                    
                    // 1. Tulis file .env.prod secara lokal di Jenkins VM dari credentials
                    withCredentials([string(credentialsId: "${ENV_PROD_ID}", variable: 'ENV_PROD_CONTENT')]) {
                        sh '''
                            echo "$ENV_PROD_CONTENT" > .env.prod
                            sed -i -E 's/ ([A-Z][A-Z_]{2,}=)/\\n\\1/g; s/ (#)/\\n\\1/g' .env.prod
                        '''
                    }
                    
                    def isLocal = sh(script: "[ -d '${TARGET_DIR}' ] && echo 'true' || echo 'false'", returnStdout: true).trim() == 'true'
                    
                    if (isLocal) {
                        echo "Mendeteksi agent berjalan di VM target secara lokal. Menjalankan deployment lokal..."
                        
                        sh "cp docker-compose.prod.yml ${TARGET_DIR}/docker-compose.prod.yml"
                        sh "cp .env.prod ${TARGET_DIR}/.env.prod"
                        sh "echo \"[VERIFY] .env.prod lines: \$(wc -l < ${TARGET_DIR}/.env.prod), DB_PASSWORD set: \$(grep -c DB_PASSWORD ${TARGET_DIR}/.env.prod)\""
                        
                        withCredentials([usernamePassword(credentialsId: "${GHCR_AUTH_ID}", usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
                            sh """
                                cd ${TARGET_DIR}
                                echo "\${GH_TOKEN}" | docker login ${REGISTRY} -u \${GH_USER} --password-stdin
                                
                                echo "Menarik Image Terbaru..."
                                docker compose -f docker-compose.prod.yml pull
                                
                                echo "Mengaktifkan Container Baru..."
                                docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --remove-orphans
                                
                                echo "Membersihkan Image Lama yang Gantung..."
                                docker image prune -f
                                
                                echo "Restart hrms-proxy..."
                                docker restart hrms-proxy
                                
                                echo "Deployment Produksi Sukses!"
                            """
                        }
                    } else {
                        echo "Menjalankan deployment remote via SSH/SCP..."
                        withCredentials([sshUserPrivateKey(credentialsId: "${SSH_CREDENTIAL_ID}", keyFileVariable: 'SSH_KEY')]) {
                            sh "scp -i \${SSH_KEY} -o StrictHostKeyChecking=no docker-compose.prod.yml ${TARGET_VM_USER}@${TARGET_VM_IP}:${TARGET_DIR}/docker-compose.prod.yml"
                            sh "scp -i \${SSH_KEY} -o StrictHostKeyChecking=no .env.prod ${TARGET_VM_USER}@${TARGET_VM_IP}:${TARGET_DIR}/.env.prod"
                            sh "ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no ${TARGET_VM_USER}@${TARGET_VM_IP} 'echo \"[VERIFY] .env.prod lines: \$(wc -l < ${TARGET_DIR}/.env.prod), DB_PASSWORD set: \$(grep -c DB_PASSWORD ${TARGET_DIR}/.env.prod)\"'"
                            
                            withCredentials([usernamePassword(credentialsId: "${GHCR_AUTH_ID}", usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
                                sh """
                                    ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no ${TARGET_VM_USER}@${TARGET_VM_IP} '
                                        cd ${TARGET_DIR}
                                        echo "\${GH_TOKEN}" | docker login ${REGISTRY} -u \${GH_USER} --password-stdin
                                        
                                        echo "Menarik Image Terbaru..."
                                        docker compose -f docker-compose.prod.yml pull
                                        
                                        echo "Mengaktifkan Container Baru..."
                                        docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --remove-orphans
                                        
                                        echo "Membersihkan Image Lama yang Gantung..."
                                        docker image prune -f
                                        
                                        echo "Restart hrms-proxy..."
                                        docker restart hrms-proxy
                                        
                                        echo "Deployment Produksi Remote Sukses!"
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
            sh "rm -f .env.prod .env.staging"
            cleanWs()
        }
    }
}
