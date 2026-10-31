package logger

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Logger struct {
	mu      sync.Mutex
	file    *os.File
	path    string
	maxSize int64
}

var defaultLogger *Logger

func Init(filePath string) error {
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0750); err != nil {
		return err
	}

	f, err := os.OpenFile(filePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0640)
	if err != nil {
		return err
	}

	multi := io.MultiWriter(os.Stdout, f)
	log.SetOutput(multi)
	log.SetFlags(log.Ldate | log.Ltime | log.LUTC)

	defaultLogger = &Logger{
		file:    f,
		path:    filePath,
		maxSize: 10 * 1024 * 1024, // 10 MB
	}

	return nil
}

func Info(format string, v ...interface{}) {
	msg := fmt.Sprintf(format, v...)
	log.Printf("[INFO] %s", msg)
}

func Warn(format string, v ...interface{}) {
	msg := fmt.Sprintf(format, v...)
	log.Printf("[WARN] %s", msg)
}

func Error(format string, v ...interface{}) {
	msg := fmt.Sprintf(format, v...)
	log.Printf("[ERROR] %s", msg)
}

func Close() {
	if defaultLogger != nil && defaultLogger.file != nil {
		_ = defaultLogger.file.Close()
	}
}
