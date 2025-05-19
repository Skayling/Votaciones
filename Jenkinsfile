pipeline {
    agent any

    environment {
        ANSIBLE_INVENTORY = "/etc/ansible/hosts"
        DEPLOY_PLAYBOOK = "/etc/ansible/deploy.yml"
        CREATE_SERVER_PLAYBOOK = "ansible/create_server.yml"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Run Tests') {
            steps {
                echo "Aquí podrías ejecutar tests automáticos"
                // Example: sh 'npm test' or 'mvn test'
            }
        }

        stage('Prepare Infra') {
            when {
                anyOf {
                    branch 'main'
                    branch 'dev'
                }
            }
            steps {
                echo "Creando infraestructura con Ansible..."
                sh "ansible-playbook ${CREATE_SERVER_PLAYBOOK} -i ${ANSIBLE_INVENTORY}"
            }
        }

        stage('Deploy') {
            when {
                anyOf {
                    branch 'main'
                    branch 'dev'
                }
            }
            steps {
                echo "Desplegando a entorno ${env.BRANCH_NAME}..."
                sh "ansible-playbook ${DEPLOY_PLAYBOOK} -i ${ANSIBLE_INVENTORY}"
            }
        }
    }

    post {
        success {
            echo "Despliegue exitoso en la rama ${env.BRANCH_NAME}"
        }
        failure {
            echo "Error en el pipeline para la rama ${env.BRANCH_NAME}"
        }
    }
}
