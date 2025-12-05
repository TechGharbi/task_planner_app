// ==================== CONFIGURATION ====================
const CONFIG = {
    STORAGE_KEY: 'planificateur_taches_v2',
    DEFAULT_CATEGORIES: [
        { id: 'work', name: 'Travail', color: '#28a745', icon: 'bx bx-briefcase' },
        { id: 'personal', name: 'Personnel', color: '#007bff', icon: 'bx bx-home' },
        { id: 'shopping', name: 'Courses', color: '#ffc107', icon: 'bx bx-shopping-bag' },
        { id: 'health', name: 'Santé', color: '#17a2b8', icon: 'bx bx-heart' },
        { id: 'study', name: 'Étude', color: '#6f42c1', icon: 'bx bx-book' },
        { id: 'family', name: 'Famille', color: '#e83e8c', icon: 'bx bx-group' }
    ],
    PRIORITIES: {
        low: { name: 'Basse', color: '#28a745' },
        medium: { name: 'Moyenne', color: '#ffc107' },
        high: { name: 'Haute', color: '#dc3545' },
        urgent: { name: 'Urgente', color: '#c2185b' }
    },
    DAYS: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
};

// ==================== GESTIONNAIRE DE TÂCHES ====================
class TaskPlanner {
    constructor() {
        this.tasks = this.loadTasks();
        this.categories = this.loadCategories();
        this.goals = this.loadGoals();
        this.currentDay = new Date().getDay();
        this.currentFilter = 'all';
        this.currentSort = 'newest';
        this.viewMode = 'list';
        this.isLatestFirst = true;
        
        this.init();
    }
    
    init() {
        this.updateUI();
        this.setupEventListeners();
        this.checkForNotifications();
        this.updateDate();
        
        // Vérifier les rappels toutes les minutes
        setInterval(() => this.checkForNotifications(), 60000);
    }
    
    // ==================== CHARGEMENT DES DONNÉES ====================
    loadTasks() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                // S'assurer que nous avons 7 jours
                const tasks = {};
                for (let i = 0; i < 7; i++) {
                    tasks[i] = data[i] || [];
                }
                return tasks;
            }
        } catch (e) {
            console.error('Erreur de chargement des tâches:', e);
        }
        
        // Données par défaut
        const defaultTasks = {};
        for (let i = 0; i < 7; i++) {
            defaultTasks[i] = [];
        }
        return defaultTasks;
    }
    
    loadCategories() {
        try {
            const saved = localStorage.getItem('task_categories');
            return saved ? JSON.parse(saved) : CONFIG.DEFAULT_CATEGORIES;
        } catch (e) {
            return CONFIG.DEFAULT_CATEGORIES;
        }
    }
    
    loadGoals() {
        try {
            const saved = localStorage.getItem('weekly_goals');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    }
    
    // ==================== SAUVEGARDE DES DONNÉES ====================
    saveTasks() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.tasks));
            this.updateStats();
            this.updateWeekOverview();
            this.updateDayCounts();
        } catch (e) {
            this.showNotification('Erreur de sauvegarde! Stockage peut être plein.', 'error');
        }
    }
    
    saveCategories() {
        localStorage.setItem('task_categories', JSON.stringify(this.categories));
    }
    
    saveGoals() {
        localStorage.setItem('weekly_goals', JSON.stringify(this.goals));
    }
    
    // ==================== GESTION DES TÂCHES ====================
    addTask(taskData) {
        const task = {
            id: Date.now() + Math.random(),
            ...taskData,
            createdAt: new Date().toISOString(),
            completed: false,
            completedAt: null,
            day: this.currentDay
        };
        
        this.tasks[this.currentDay].push(task);
        this.saveTasks();
        this.updateUI();
        this.showNotification('Cute task added successfully! ♥', 'success');
        
        // Planifier les rappels
        if (taskData.reminder && taskData.date && taskData.time) {
            this.scheduleReminder(task);
        }
        
        // Gérer la répétition
        if (taskData.repeat && taskData.repeat !== 'none') {
            this.scheduleRecurringTask(task, taskData.repeat);
        }
        
        return task;
    }
    
    updateTask(taskId, updates) {
        const dayTasks = this.tasks[this.currentDay];
        const taskIndex = dayTasks.findIndex(t => t.id === taskId);
        
        if (taskIndex !== -1) {
            dayTasks[taskIndex] = { ...dayTasks[taskIndex], ...updates };
            this.saveTasks();
            this.updateUI();
            return true;
        }
        return false;
    }
    
    deleteTask(taskId) {
        this.tasks[this.currentDay] = this.tasks[this.currentDay].filter(t => t.id !== taskId);
        this.saveTasks();
        this.updateUI();
        this.showNotification('Tâche supprimée', 'info');
    }
    
    toggleTaskCompletion(taskId) {
        const task = this.tasks[this.currentDay].find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            this.saveTasks();
            this.updateUI();
            
            const message = task.completed ? 'Super! Tâche terminée' : 'Tâche réouverte';
            this.showNotification(message, 'success');
        }
    }
    
    // ==================== PLANIFICATION AVANCÉE ====================
    scheduleRecurringTask(task, pattern) {
        const daysToSchedule = [];
        
        switch (pattern) {
            case 'daily':
                for (let i = 0; i < 7; i++) daysToSchedule.push(i);
                break;
            case 'weekly':
                daysToSchedule.push(this.currentDay);
                break;
            case 'weekdays':
                for (let i = 1; i <= 5; i++) daysToSchedule.push(i);
                break;
            case 'monthly':
                // Ajouter au même jour du mois suivant
                const nextMonth = new Date();
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                daysToSchedule.push(nextMonth.getDay());
                break;
        }
        
        daysToSchedule.forEach(day => {
            if (day !== this.currentDay) {
                const recurringTask = {
                    ...task,
                    id: Date.now() + Math.random() + day,
                    originalId: task.id,
                    day: day,
                    isRecurring: true,
                    pattern: pattern
                };
                
                if (!this.tasks[day].some(t => t.originalId === task.id && t.pattern === pattern)) {
                    this.tasks[day].push(recurringTask);
                }
            }
        });
        
        this.saveTasks();
    }
    
    scheduleReminder(task) {
        if (!('Notification' in window)) return;
        
        if (Notification.permission === 'granted') {
            this.setReminderTimeout(task);
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.setReminderTimeout(task);
                }
            });
        }
    }
    
    setReminderTimeout(task) {
        const reminderTime = new Date(`${task.date}T${task.time}`);
        const now = new Date();
        const timeDiff = reminderTime - now;
        
        if (timeDiff > 0) {
            setTimeout(() => {
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('Rappel de tâche', {
                        body: `⏰ ${task.title}`,
                        icon: '/icon.png',
                        tag: `task-${task.id}`
                    });
                }
                this.showNotification(`Rappel: ${task.title}`, 'info');
            }, timeDiff);
        }
    }
    
    checkForNotifications() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        this.tasks[this.currentDay].forEach(task => {
            if (task.date === today && task.time && !task.completed) {
                const [hours, minutes] = task.time.split(':');
                const taskTime = new Date();
                taskTime.setHours(hours, minutes, 0, 0);
                
                const diff = taskTime - now;
                if (diff > 0 && diff < 60000) {
                    this.showNotification(`Rappel: ${task.title} commence dans 1 minute`, 'info');
                }
            }
        });
    }
    
    // ==================== GESTION DES CATÉGORIES ====================
    addCategory(categoryData) {
        const category = {
            id: Date.now().toString(),
            ...categoryData
        };
        
        this.categories.push(category);
        this.saveCategories();
        this.renderCategories();
        this.showNotification('Catégorie ajoutée', 'success');
    }
    
    deleteCategory(categoryId) {
        this.categories = this.categories.filter(c => c.id !== categoryId);
        this.saveCategories();
        this.renderCategories();
        this.showNotification('Catégorie supprimée', 'info');
    }
    
    // ==================== GESTION DES OBJECTIFS ====================
    addGoal(goalText) {
        const goal = {
            id: Date.now(),
            text: goalText,
            completed: false,
            target: 1,
            current: 0,
            createdAt: new Date().toISOString()
        };
        
        this.goals.push(goal);
        this.saveGoals();
        this.renderGoals();
        this.showNotification('Objectif ajouté', 'success');
    }
    
    toggleGoalCompletion(goalId) {
        const goal = this.goals.find(g => g.id === goalId);
        if (goal) {
            goal.completed = !goal.completed;
            goal.current = goal.completed ? goal.target : 0;
            this.saveGoals();
            this.renderGoals();
        }
    }
    
    updateGoalProgress(goalId, progress) {
        const goal = this.goals.find(g => g.id === goalId);
        if (goal) {
            goal.current = Math.min(progress, goal.target);
            goal.completed = goal.current >= goal.target;
            this.saveGoals();
            this.renderGoals();
        }
    }
    
    // ==================== FILTRES ET TRI ====================
    getFilteredTasks() {
        let tasks = [...this.tasks[this.currentDay]];
        
        // Appliquer le filtre
        switch (this.currentFilter) {
            case 'pending':
                tasks = tasks.filter(t => !t.completed);
                break;
            case 'completed':
                tasks = tasks.filter(t => t.completed);
                break;
            case 'today':
                const today = new Date().toISOString().split('T')[0];
                tasks = tasks.filter(t => t.date === today);
                break;
        }
        
        // Appliquer le tri
        tasks.sort((a, b) => {
            if (this.isLatestFirst) {
                return new Date(b.createdAt) - new Date(a.createdAt);
            } else {
                return new Date(a.createdAt) - new Date(b.createdAt);
            }
        });
        
        // Trier par priorité (urgent d'abord)
        tasks.sort((a, b) => {
            const priorityOrder = { urgent: 3, high: 2, medium: 1, low: 0 };
            return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        });
        
        return tasks;
    }
    
    changeFilter(filter) {
        this.currentFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        this.updateUI();
    }
    
    toggleSort() {
        this.isLatestFirst = !this.isLatestFirst;
        const btn = document.getElementById('sort-text');
        btn.textContent = this.isLatestFirst 
            ? 'Trier par plus récent' 
            : 'Trier par plus ancien';
        this.updateUI();
    }
    
    toggleViewMode() {
        this.viewMode = this.viewMode === 'list' ? 'grid' : 'list';
        const icon = document.getElementById('view-icon');
        icon.className = this.viewMode === 'grid' ? 'bx bx-list-ul' : 'bx bx-grid';
        this.updateUI();
    }
    
    // ==================== STATISTIQUES ====================
    updateStats() {
        const allTasks = Object.values(this.tasks).flat();
        const totalTasks = allTasks.length;
        const completedTasks = allTasks.filter(t => t.completed).length;
        const pendingTasks = totalTasks - completedTasks;
        
        // Calcul de la productivité (pourcentage de tâches complétées)
        const productivity = totalTasks > 0 
            ? Math.round((completedTasks / totalTasks) * 100) 
            : 0;
        
        document.getElementById('total-tasks').textContent = totalTasks;
        document.getElementById('completed-tasks').textContent = completedTasks;
        document.getElementById('pending-tasks').textContent = pendingTasks;
        document.getElementById('productivity').textContent = `${productivity}%`;
        
        // Mettre à jour les compteurs de filtre
        const todayTasks = this.tasks[this.currentDay];
        const todayCompleted = todayTasks.filter(t => t.completed).length;
        
        document.getElementById('count-all').textContent = todayTasks.length;
        document.getElementById('count-pending').textContent = todayTasks.length - todayCompleted;
        document.getElementById('count-completed').textContent = todayCompleted;
        document.getElementById('count-today').textContent = this.getTodayTasksCount();
    }
    
    getTodayTasksCount() {
        const today = new Date().toISOString().split('T')[0];
        let count = 0;
        
        for (let i = 0; i < 7; i++) {
            count += this.tasks[i].filter(t => t.date === today).length;
        }
        
        return count;
    }
    
    // ==================== MISE À JOUR DE L'INTERFACE ====================
    updateUI() {
        this.updateDayTitle();
        this.updateTaskLists();
        this.updateStats();
        this.updateEmptyState();
        this.updateDate();
    }
    
    updateDayTitle() {
        document.getElementById('current-day-name').textContent = CONFIG.DAYS[this.currentDay];
        
        // Mettre à jour la sélection des jours
        document.querySelectorAll('.day-item').forEach((item, index) => {
            item.classList.toggle('active', index === this.currentDay);
        });
    }
    
    updateTaskLists() {
        const tasks = this.getFilteredTasks();
        const tasksGrid = document.getElementById('tasksGrid');
        const tasksList = document.getElementById('tasksList');
        
        // Vider les listes
        tasksGrid.innerHTML = '';
        tasksList.innerHTML = '';
        
        if (tasks.length === 0) {
            tasksGrid.style.display = 'none';
            tasksList.style.display = 'none';
            return;
        }
        
        // Créer les cartes de tâches
        tasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            
            if (this.viewMode === 'grid') {
                tasksGrid.appendChild(taskElement.cloneNode(true));
            } else {
                tasksList.appendChild(taskElement.cloneNode(true));
            }
        });
        
        // Afficher le mode de vue approprié
        if (this.viewMode === 'grid') {
            tasksGrid.style.display = 'grid';
            tasksList.style.display = 'none';
        } else {
            tasksGrid.style.display = 'none';
            tasksList.style.display = 'block';
        }
    }
    
    createTaskElement(task) {
        const category = this.categories.find(c => c.id === task.category) || this.categories[0];
        const priority = CONFIG.PRIORITIES[task.priority || 'medium'];
        
        const taskDiv = document.createElement('div');
        taskDiv.className = `task-card ${task.completed ? 'completed' : ''}`;
        taskDiv.innerHTML = `
            <div class="task-header">
                <span class="task-category" 
                      style="background: ${category.color}20; color: ${category.color}; border: 1px solid ${category.color}30">
                    <i class="${category.icon}"></i>
                    ${category.name}
                </span>
                <span class="task-priority priority-${task.priority}" 
                      style="color: ${priority.color}; border: 1px solid ${priority.color}30">
                    <i class='bx bx-flag'></i>
                    ${priority.name}
                </span>
            </div>
            
            <div class="task-body">
                <h3 class="task-title">${task.title}</h3>
                ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
                
                <div class="task-meta">
                    <div class="task-time">
                        ${task.date ? `
                            <i class='bx bx-calendar'></i>
                            ${this.formatDate(task.date)}
                        ` : ''}
                        ${task.time ? `
                            <i class='bx bx-time'></i>
                            ${task.time}
                        ` : ''}
                    </div>
                    
                    ${task.tags ? `
                        <div class="task-tags">
                            ${task.tags.split(',').map(tag => `
                                <span class="task-tag">${tag.trim()}</span>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <div class="task-actions">
                        <button class="action-btn complete" onclick="taskPlanner.toggleTaskCompletion(${task.id})">
                            <i class='bx ${task.completed ? 'bx-undo' : 'bx-check'}'></i>
                        </button>
                        <button class="action-btn edit" onclick="editTask(${task.id})">
                            <i class='bx bx-edit'></i>
                        </button>
                        <button class="action-btn delete" onclick="taskPlanner.deleteTask(${task.id})">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        return taskDiv;
    }
    
    updateEmptyState() {
        const tasks = this.tasks[this.currentDay];
        const emptyState = document.getElementById('emptyState');
        
        if (tasks.length === 0) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
        }
    }
    
    updateDate() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('currentDate').textContent = now.toLocaleDateString('fr-FR', options);
    }
    
    // ==================== VUE D'ENSEMBLE DE LA SEMAINE ====================
    updateWeekOverview() {
        const weekGrid = document.getElementById('weekDaysGrid');
        if (!weekGrid) return;
        
        weekGrid.innerHTML = '';
        
        for (let i = 0; i < 7; i++) {
            const dayTasks = this.tasks[i];
            const completedTasks = dayTasks.filter(t => t.completed).length;
            const completionRate = dayTasks.length > 0 
                ? Math.round((completedTasks / dayTasks.length) * 100) 
                : 0;
            
            const dayCard = document.createElement('div');
            dayCard.className = `week-day-card ${i === this.currentDay ? 'active' : ''}`;
            dayCard.dataset.day = i;
            dayCard.innerHTML = `
                <div class="day-name">${CONFIG.DAYS[i].substring(0, 3)}</div>
                <div class="task-count">${dayTasks.length}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${completionRate}%"></div>
                </div>
                <div class="completion-rate">${completionRate}%</div>
            `;
            
            dayCard.addEventListener('click', () => {
                this.switchToDay(i);
            });
            
            weekGrid.appendChild(dayCard);
        }
    }
    
    updateDayCounts() {
        document.querySelectorAll('.day-item').forEach((item, index) => {
            const count = this.tasks[index].length;
            const countSpan = item.querySelector('.day-count');
            if (countSpan) {
                countSpan.textContent = count;
            }
        });
    }
    
    switchToDay(dayIndex) {
        this.currentDay = dayIndex;
        this.updateUI();
        
        // Fermer le sidebar sur mobile
        if (window.innerWidth <= 768) {
            document.querySelector('.sidebar').classList.remove('open');
        }
    }
    
    // ==================== RENDU DES LISTES ====================
    renderCategories() {
        const categoriesList = document.getElementById('categoriesList');
        if (!categoriesList) return;
        
        categoriesList.innerHTML = '';
        
        this.categories.forEach(category => {
            const categoryCount = this.getCategoryTaskCount(category.id);
            
            const li = document.createElement('li');
            li.className = 'category-item';
            li.innerHTML = `
                <span class="category-color" style="background: ${category.color}"></span>
                <i class="${category.icon}"></i>
                <span>${category.name}</span>
                <span class="category-count">${categoryCount}</span>
            `;
            
            categoriesList.appendChild(li);
        });
    }
    
    renderGoals() {
        const goalsList = document.getElementById('goalsList');
        if (!goalsList) return;
        
        goalsList.innerHTML = '';
        
        this.goals.forEach(goal => {
            const goalItem = document.createElement('div');
            goalItem.className = 'goal-item';
            goalItem.innerHTML = `
                <input type="checkbox" class="goal-checkbox" ${goal.completed ? 'checked' : ''}
                       onchange="taskPlanner.toggleGoalCompletion(${goal.id})">
                <span class="goal-text ${goal.completed ? 'completed' : ''}">${goal.text}</span>
                <span class="goal-progress">${goal.current}/${goal.target}</span>
            `;
            
            goalsList.appendChild(goalItem);
        });
    }
    
    getCategoryTaskCount(categoryId) {
        let count = 0;
        for (let i = 0; i < 7; i++) {
            count += this.tasks[i].filter(t => t.category === categoryId).length;
        }
        return count;
    }
    
    // ==================== NOTIFICATIONS ====================
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    // ==================== UTILITAIRES ====================
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short'
        });
    }
    
    // ==================== ÉVÉNEMENTS ====================
    setupEventListeners() {
        // Jours de la semaine
        document.querySelectorAll('.day-item').forEach((item, index) => {
            item.addEventListener('click', () => {
                this.switchToDay(index);
            });
        });
        
        // Ajout rapide
        document.getElementById('todoInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addQuickTask();
            }
        });

        
        // Formulaires
        document.getElementById('taskForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTaskFromModal();
        });
        
        document.getElementById('categoryForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCategoryFromModal();
        });
        
        // Gestion des clics en dehors du modal
        document.addEventListener('click', (e) => {
            const modals = document.querySelectorAll('.modal-overlay');
            modals.forEach(modal => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
            
            // Fermer le sidebar sur mobile
            if (window.innerWidth <= 768) {
                const sidebar = document.querySelector('.sidebar');
                const menuToggle = document.querySelector('.menu-toggle');
                if (sidebar.classList.contains('open') && 
                    !sidebar.contains(e.target) && 
                    !menuToggle.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            }
        });
        
        // Redimensionnement de la fenêtre
        window.addEventListener('resize', () => {
            if (window.innerWidth <= 768 && this.viewMode === 'grid') {
                this.viewMode = 'list';
                this.updateUI();
            }
        });
    }
    
    // ==================== FONCTIONS PUBLIQUES ====================
    addQuickTask() {
        const input = document.getElementById('todoInput');
        const title = input.value.trim();
        
        if (!title) {
            this.showNotification('Veuillez entrer un titre de tâche', 'error');
            return;
        }
        
        const category = document.getElementById('quickCategory').value;
        const time = document.getElementById('quickTime').value;
        
        const taskData = {
            title: title,
            category: category,
            time: time || null,
            date: new Date().toISOString().split('T')[0],
            priority: 'medium'
        };
        
        this.addTask(taskData);
        
        // Réinitialiser les champs
        input.value = '';
        document.getElementById('quickTime').value = '';
        input.focus();
    }
    
    saveTaskFromModal() {
        const form = document.getElementById('taskForm');
        const taskData = {
            title: document.getElementById('taskTitle').value.trim(),
            description: document.getElementById('taskDescription').value.trim(),
            category: document.getElementById('taskCategory').value,
            priority: document.getElementById('taskPriority').value,
            date: document.getElementById('taskDate').value || null,
            time: document.getElementById('taskTime').value || null,
            repeat: document.getElementById('taskRepeat').value,
            reminder: document.getElementById('taskReminder').checked,
            tags: document.getElementById('taskTags').value || null
        };
        
        if (!taskData.title) {
            this.showNotification('Le titre est requis', 'error');
            return;
        }
        
        // Si c'est une édition
        if (form.dataset.editId) {
            this.updateTask(parseFloat(form.dataset.editId), taskData);
            this.showNotification('Tâche mise à jour', 'success');
        } else {
            // Nouvelle tâche
            this.addTask(taskData);
        }
        
        this.closeTaskModal();
    }
    
    saveCategoryFromModal() {
        const categoryData = {
            name: document.getElementById('categoryName').value.trim(),
            color: document.getElementById('categoryColor').value,
            icon: document.getElementById('categoryIcon').value
        };
        
        if (!categoryData.name) {
            this.showNotification('Le nom de la catégorie est requis', 'error');
            return;
        }
        
        this.addCategory(categoryData);
        this.closeCategoryModal();
    }
    
    // ==================== MODALS ====================
    openTaskModal(task = null) {
        const modal = document.getElementById('taskModal');
        const form = document.getElementById('taskForm');
        
        if (task) {
            // Mode édition
            document.querySelector('#taskModal .modal-header h2').innerHTML = `
                <i class='bx bx-edit'></i> Modifier la Tâche
            `;
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskDescription').value = task.description || '';
            document.getElementById('taskCategory').value = task.category;
            document.getElementById('taskPriority').value = task.priority;
            document.getElementById('taskDate').value = task.date || '';
            document.getElementById('taskTime').value = task.time || '';
            document.getElementById('taskRepeat').value = task.repeat || 'none';
            document.getElementById('taskReminder').checked = !!task.reminder;
            document.getElementById('taskTags').value = task.tags || '';
            
            form.dataset.editId = task.id;
        } else {
            // Mode création
            document.querySelector('#taskModal .modal-header h2').innerHTML = `
                <i class='bx bx-edit'></i> Planifier une Tâche
            `;
            form.reset();
            
            // Définir la date d'aujourd'hui par défaut
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('taskDate').value = today;
            
            delete form.dataset.editId;
        }
        
        modal.classList.add('active');
    }
    
    closeTaskModal() {
        const modal = document.getElementById('taskModal');
        modal.classList.remove('active');
        document.getElementById('taskForm').reset();
        delete document.getElementById('taskForm').dataset.editId;
    }
    
    openCategoryModal() {
        const modal = document.getElementById('categoryModal');
        modal.classList.add('active');
    }
    
    closeCategoryModal() {
        const modal = document.getElementById('categoryModal');
        modal.classList.remove('active');
        document.getElementById('categoryForm').reset();
    }
    
    // ==================== IMPORT/EXPORT ====================
    exportData() {
        const data = {
            tasks: this.tasks,
            categories: this.categories,
            goals: this.goals,
            exportDate: new Date().toISOString(),
            version: '2.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-taches-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('Données exportées avec succès', 'success');
    }
    
    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.tasks && data.categories) {
                    this.tasks = data.tasks;
                    this.categories = data.categories;
                    this.goals = data.goals || [];
                    
                    this.saveTasks();
                    this.saveCategories();
                    this.saveGoals();
                    
                    this.updateUI();
                    this.renderCategories();
                    this.renderGoals();
                    
                    this.showNotification('Données importées avec succès', 'success');
                } else {
                    throw new Error('Format de fichier invalide');
                }
            } catch (error) {
                this.showNotification('Fichier invalide ou corrompu', 'error');
            }
        };
        reader.readAsText(file);
    }
}

// ==================== FONCTIONS GLOBALES ====================
let taskPlanner;

function editTask(taskId) {
    const task = taskPlanner.tasks[taskPlanner.currentDay].find(t => t.id === taskId);
    if (task) {
        taskPlanner.openTaskModal(task);
    }
}

function openAdvancedTaskModal() {
    taskPlanner.openTaskModal();
}

function changeFilter(filter) {
    taskPlanner.changeFilter(filter);
}

function toggleSort() {
    taskPlanner.toggleSort();
}

function toggleViewMode() {
    taskPlanner.toggleViewMode();
}

function toggleWeekView() {
    const btn = document.querySelector('.btn-view-toggle');
    const icon = btn.querySelector('i');
    const text = btn.querySelector('span') || btn;
    
    if (icon.classList.contains('bx-grid-alt')) {
        icon.className = 'bx bx-list-ul';
        text.textContent = 'Vue Liste';
        taskPlanner.viewMode = 'list';
    } else {
        icon.className = 'bx bx-grid-alt';
        text.textContent = 'Vue Grille';
        taskPlanner.viewMode = 'grid';
    }
    
    taskPlanner.updateUI();
}

function addNewGoal() {
    const goalText = prompt('Entrez votre nouvel objectif:');
    if (goalText && goalText.trim()) {
        taskPlanner.addGoal(goalText.trim());
    }
}

function exportData() {
    taskPlanner.exportData();
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        if (e.target.files[0]) {
            taskPlanner.importData(e.target.files[0]);
        }
    };
    input.click();
}

// ==================== INITIALISATION ====================
document.addEventListener('DOMContentLoaded', () => {
    taskPlanner = new TaskPlanner();
    window.taskPlanner = taskPlanner;
    
    // Mettre à jour l'interface initiale
    taskPlanner.updateWeekOverview();
    taskPlanner.renderCategories();
    taskPlanner.renderGoals();
    
    // Ajouter le bouton d'import
    const importBtn = document.createElement('button');
    importBtn.className = 'btn btn-secondary';
    importBtn.innerHTML = '<i class="bx bx-import"></i> Importer';
    importBtn.onclick = importData;
    document.querySelector('.header-actions').appendChild(importBtn);
    
    // Support hors ligne
    window.addEventListener('online', () => {
        taskPlanner.showNotification('Connexion rétablie', 'success');
    });
    
    window.addEventListener('offline', () => {
        taskPlanner.showNotification('Vous êtes hors ligne', 'warning');
    });
});

// ==================== PWA INSTALL PROMPT ====================
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Afficher un bouton d'installation
    const installBtn = document.createElement('button');
    installBtn.className = 'btn btn-success';
    installBtn.innerHTML = '<i class="bx bx-download"></i> Installer l\'App';
    installBtn.style.marginLeft = '10px';
    
    installBtn.onclick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                taskPlanner.showNotification('Application installée avec succès!', 'success');
            }
            deferredPrompt = null;
            installBtn.remove();
        }
    };
    
    document.querySelector('.header-actions').appendChild(installBtn);
});